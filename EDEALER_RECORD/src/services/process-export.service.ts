import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import { config } from '../config';
import { LocalStorageProvider } from '../storage/local-storage.provider';
import {
  findProcessIdsForExport,
  type ExportDateField,
  type VehicleProcessStatusFilter,
} from '../repositories/vehicle-process.repository';
import { listProcessExpensesByProcessIds } from '../repositories/process-expense.repository';
import { findDealerById } from '../repositories/dealer.repository';
import {
  getVehicleProcessDetails,
  type VehicleProcessDetailsDto,
  type VehicleProcessPhotoDetailDto,
} from './vehicle-process.service';
import type { ExportSection } from '../validations/process-export.validation';

/** Storage reader for pulling stored image bytes to embed (mirrors upload.service's provider wiring). */
const storage = new LocalStorageProvider(config);

/** Hard cap on how many processes a single export covers (bounds DB work + generation time). */
const MAX_EXPORT_PROCESSES = 500;
/** Global cap on embedded images per export — bounds peak memory (each ≈ a few tens of KB of JPEG). */
const MAX_EMBEDDED_IMAGES = 300;
/** Per-process-per-section cap on embedded images, so one process can't consume the whole budget. */
const PER_PROCESS_IMAGE_CAP = 8;
/** Bounded concurrency for the per-process detail fetches (keeps the DB pool comfortable). */
const DB_CONCURRENCY = 5;
/** Bounded concurrency for sharp transcodes (CPU-bound; a small pool cuts wall-clock without thrashing). */
const IMG_CONCURRENCY = 6;

const EXCEL_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const PDF_MIME = 'application/pdf';

// Modern palette shared by both generators.
const INK = '#0f172a';
const MUTED = '#64748b';
const LINE = '#e2e8f0';
const ACCENT = '#2563eb';
const HEADER_BG = '#f1f5f9';
const STATUS_HEX: Record<string, string> = { SOLD: '#16a34a', COMPLETE: '#2563eb', SCRAP: '#dc2626' };

/** A single process plus its derived money figures, the unit the generators render. */
interface ProcessExportRecord {
  details: VehicleProcessDetailsDto;
  expenseTotal: number;
  /** salePrice − purchasePrice − Σexpenses, or null when either price is missing. */
  profit: number | null;
}

/** Pre-loaded image bytes + which images were planned, so the generators embed without awaiting. */
interface ImagePlan {
  /** imageName → transcoded JPEG bytes (absent when the read/transcode failed). */
  buffers: Map<string, Buffer>;
  /** imageNames that were WITHIN budget and attempted. */
  planned: Set<string>;
  /** True when more embeddable images existed than {@link MAX_EMBEDDED_IMAGES} allowed. */
  truncated: boolean;
}

/** Header/footer metadata shared by both generators. All firm fields are null for an all-dealers export. */
interface ExportMeta {
  rangeLabel: string;
  truncated: boolean;
  /** The dealer's firm name, shown at the top. */
  firmName: string | null;
  /** The dealer's address line: "Address, City, State - Pincode". */
  firmAddress: string | null;
  /** The dealer's contact mobile number. */
  firmMobile: string | null;
}

/** Parameters for an export request (dealer already resolved by the controller). */
export interface ExportParams {
  dealerId: string | null;
  format: 'excel' | 'pdf';
  dateFrom?: string | null;
  dateTo?: string | null;
  /** Which date column the range filters on (default 'processDate'). */
  dateField: ExportDateField;
  /** Lifecycle statuses to include; empty = every status. */
  statuses: VehicleProcessStatusFilter[];
  sections: Set<ExportSection>;
  publicOrigin?: string;
}

/** The generated file plus the headers the controller needs. */
export interface ExportResult {
  buffer: Buffer;
  filename: string;
  contentType: string;
  count: number;
  /** True when the process count OR the embedded-image count was capped. */
  truncated: boolean;
}

// ── small async utility ────────────────────────────────────────────────────

/**
 * Maps `items` through `fn` with at most `limit` in flight, preserving input order in the result.
 *
 * @param items - The inputs.
 * @param limit - Max concurrent `fn` executions.
 * @param fn - Async mapper.
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

// ── formatting helpers ──────────────────────────────────────────────────────

const dateFmt = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const moneyFmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });

function fmtDate(value: Date | string | null | undefined): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? '' : dateFmt.format(d);
}

function fmtMoney(value: number | null | undefined): string {
  return value == null ? '' : moneyFmt.format(value);
}

const amountFmt = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Money for the PDF: "Rs. 3,00,000.00". The PDF's built-in Helvetica has no rupee glyph (the sign
 * draws as a stray mark), so the PDF spells the currency out. Excel keeps the sign via {@link fmtMoney}.
 */
function fmtMoneyPdf(value: number | null | undefined): string {
  if (value == null) return '';
  return `${value < 0 ? '-' : ''}Rs. ${amountFmt.format(Math.abs(value))}`;
}

function fmtMfg(month?: number | null, year?: number | null): string {
  if (!year) return '';
  return month ? `${String(month).padStart(2, '0')}/${year}` : String(year);
}

function fmtStatus(status: string | null): string {
  return status ?? 'OPEN';
}

function statusHex(status: string | null): string {
  return status ? (STATUS_HEX[status] ?? '#f59e0b') : '#f59e0b';
}

function hexToArgb(hex: string): string {
  return `FF${hex.replace('#', '').toUpperCase()}`;
}

function isPdfKey(imageName: string): boolean {
  return /\.pdf$/i.test(imageName);
}

/** "Make | Model" (pipe-separated), omitting a missing half. */
function makeModel(vehicle: VehicleProcessDetailsDto['vehicle']): string {
  return [vehicle?.make, vehicle?.model].filter(Boolean).join(' | ');
}

/** A thin light-grey border on all four sides (for a clean Excel grid). */
function thinBorder(): Partial<ExcelJS.Borders> {
  const side: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: 'FFE2E8F0' } };
  return { top: side, left: side, bottom: side, right: side };
}

/**
 * Widens each column to fit its longest cell (clamped), so no value is clipped. `skipRows` leading
 * rows are ignored — notably a merged title row, whose value every column's slave cell would otherwise
 * report (ExcelJS returns the master value for merged cells), ballooning every column to the title length.
 */
function autosizeColumns(sheet: ExcelJS.Worksheet, minWidths: number[], skipRows = 0): void {
  sheet.columns.forEach((col, i) => {
    let max = minWidths[i] ?? 10;
    col.eachCell?.({ includeEmpty: false }, (cell, rowNumber) => {
      if (rowNumber <= skipRows) return;
      const text = cell.value == null ? '' : String(cell.value);
      const longest = text.split('\n').reduce((m, line) => Math.max(m, line.length), 0);
      if (longest > max) max = longest;
    });
    col.width = Math.min(Math.max(max + 2, 10), 48);
  });
}

/** The photos of one record for an image section, capped per process. */
function sectionPhotos(
  record: ProcessExportRecord,
  section: 'documents' | 'vehicleImages',
): VehicleProcessPhotoDetailDto[] {
  const all = section === 'documents' ? record.details.photos : record.details.vehiclePhotos;
  return all.slice(0, PER_PROCESS_IMAGE_CAP);
}

// ── per-process view model (details + images) ────────────────────────────────

interface Field {
  label: string;
  value: string;
}
interface Group {
  title: string;
  fields: Field[];
}
interface CardPhoto {
  imageName: string;
  category: string;
  isPdf: boolean;
}

/** Scalar detail groups for the selected sections, dropping empty fields and empty groups. */
function detailGroups(record: ProcessExportRecord, sections: Set<ExportSection>): Group[] {
  const d = record.details;
  const groups: Group[] = [];
  const push = (title: string, fields: Field[]): void => {
    const nonEmpty = fields.filter((f) => f.value && f.value.trim() !== '');
    if (nonEmpty.length) groups.push({ title, fields: nonEmpty });
  };
  if (sections.has('vehicle')) {
    // Make/Model already appears in the card header, so it is NOT repeated here. Field order:
    // Chassis & Engine, then Reg Date & Mfg, then Type.
    push('Vehicle', [
      { label: 'Chassis', value: d.vehicle?.chassisNumber ?? '' },
      { label: 'Engine', value: d.vehicle?.engineNumber ?? '' },
      { label: 'Reg Date', value: fmtDate(d.vehicle?.registrationDate ?? null) },
      { label: 'Mfg', value: fmtMfg(d.vehicle?.manufactureMonth, d.vehicle?.manufactureYear) },
      { label: 'Type', value: d.vehicle?.vehicleType ?? '' },
    ]);
  }
  if (sections.has('persons')) {
    // Ordered so the left column is the seller and the right column is the buyer (name / mobile /
    // address rows) when both are present.
    push('Seller & Buyer', [
      { label: 'Seller', value: d.owner?.personName ?? '' },
      { label: 'Buyer', value: d.buyer?.personName ?? '' },
      { label: 'Seller Mobile', value: d.owner?.mobileNumber ?? '' },
      { label: 'Buyer Mobile', value: d.buyer?.mobileNumber ?? '' },
      { label: 'Seller Address', value: d.owner?.address ?? '' },
      { label: 'Buyer Address', value: d.buyer?.address ?? '' },
    ]);
  }
  if (sections.has('deal')) {
    push('Deal & Reference', [
      { label: 'Deal No', value: d.dealNumber ?? '' },
      { label: 'Process Date', value: fmtDate(d.processDate) },
      { label: 'Sold Date', value: fmtDate(d.soldDate) },
      { label: 'Seller Ref', value: d.references.seller?.referenceName ?? '' },
      { label: 'Buyer Ref', value: d.references.buyer?.referenceName ?? '' },
    ]);
  }
  if (sections.has('amount')) {
    push('Amount & Expense', [
      { label: 'Purchase', value: fmtMoneyPdf(d.purchasePrice) },
      { label: 'Sale', value: fmtMoneyPdf(d.salePrice) },
      { label: 'Expenses', value: record.expenseTotal ? fmtMoneyPdf(record.expenseTotal) : '' },
      { label: 'Profit', value: record.profit == null ? '' : fmtMoneyPdf(record.profit) },
    ]);
  }
  return groups;
}

/** Document + vehicle photos for a record, combined (documents first), each capped per process. */
function cardPhotos(record: ProcessExportRecord, sections: Set<ExportSection>): CardPhoto[] {
  const out: CardPhoto[] = [];
  const add = (photos: VehicleProcessPhotoDetailDto[]): void => {
    for (const p of photos) out.push({ imageName: p.imageName, category: p.category, isPdf: isPdfKey(p.imageName) });
  };
  if (sections.has('documents')) add(sectionPhotos(record, 'documents'));
  if (sections.has('vehicleImages')) add(sectionPhotos(record, 'vehicleImages'));
  return out;
}

// ── Summary (tabular) columns — used by the Excel Summary sheet ──────────────

interface Column {
  header: string;
  width: number;
  value: (record: ProcessExportRecord) => string;
}

function buildColumns(sections: Set<ExportSection>): Column[] {
  const columns: Column[] = [
    { header: 'Reg No', width: 16, value: (r) => r.details.vehicle?.registrationNumber ?? '—' },
    { header: 'Status', width: 11, value: (r) => fmtStatus(r.details.status) },
  ];
  if (sections.has('vehicle')) {
    columns.push(
      { header: 'Make / Model', width: 24, value: (r) => makeModel(r.details.vehicle) },
      { header: 'Mfg', width: 10, value: (r) => fmtMfg(r.details.vehicle?.manufactureMonth, r.details.vehicle?.manufactureYear) },
      { header: 'Reg Date', width: 13, value: (r) => fmtDate(r.details.vehicle?.registrationDate ?? null) },
      { header: 'Chassis', width: 20, value: (r) => r.details.vehicle?.chassisNumber ?? '' },
      { header: 'Engine', width: 18, value: (r) => r.details.vehicle?.engineNumber ?? '' },
      { header: 'Type', width: 12, value: (r) => r.details.vehicle?.vehicleType ?? '' },
    );
  }
  if (sections.has('persons')) {
    columns.push(
      { header: 'Seller', width: 18, value: (r) => r.details.owner?.personName ?? '' },
      { header: 'Seller Mobile', width: 15, value: (r) => r.details.owner?.mobileNumber ?? '' },
      { header: 'Seller Address', width: 28, value: (r) => r.details.owner?.address ?? '' },
      { header: 'Buyer', width: 18, value: (r) => r.details.buyer?.personName ?? '' },
      { header: 'Buyer Mobile', width: 15, value: (r) => r.details.buyer?.mobileNumber ?? '' },
      { header: 'Buyer Address', width: 28, value: (r) => r.details.buyer?.address ?? '' },
    );
  }
  if (sections.has('deal')) {
    columns.push(
      { header: 'Deal No', width: 14, value: (r) => r.details.dealNumber ?? '' },
      { header: 'Process Date', width: 13, value: (r) => fmtDate(r.details.processDate) },
      { header: 'Sold Date', width: 13, value: (r) => fmtDate(r.details.soldDate) },
      { header: 'Seller Ref', width: 16, value: (r) => r.details.references.seller?.referenceName ?? '' },
      { header: 'Buyer Ref', width: 16, value: (r) => r.details.references.buyer?.referenceName ?? '' },
    );
  }
  if (sections.has('amount')) {
    columns.push(
      { header: 'Purchase', width: 14, value: (r) => fmtMoney(r.details.purchasePrice) },
      { header: 'Sale', width: 14, value: (r) => fmtMoney(r.details.salePrice) },
      { header: 'Expenses', width: 14, value: (r) => fmtMoney(r.expenseTotal) },
      { header: 'Profit', width: 14, value: (r) => (r.profit == null ? '' : fmtMoney(r.profit)) },
    );
  }
  return columns;
}

// ── image loading ────────────────────────────────────────────────────────────

/**
 * Reads a stored image and transcodes it to a compact JPEG for embedding (stored images are WebP,
 * which neither ExcelJS nor PDFKit can embed). Returns null for PDFs / unreadable files.
 *
 * @param imageName - The storage key of the image.
 */
async function loadImageForEmbed(imageName: string): Promise<Buffer | null> {
  if (isPdfKey(imageName)) return null;
  try {
    const raw = await storage.readFile(imageName);
    const jpeg = await sharp(raw)
      .rotate()
      .resize({ width: 600, height: 600, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 72 })
      .toBuffer();
    return Buffer.from(jpeg); // strict Buffer<ArrayBuffer> for ExcelJS
  } catch {
    return null;
  }
}

/**
 * Plans and pre-loads the images to embed, bounded by {@link MAX_EMBEDDED_IMAGES} globally and
 * {@link PER_PROCESS_IMAGE_CAP} per process-section, transcoded at {@link IMG_CONCURRENCY}.
 *
 * @param records - The records to source images from.
 * @param sections - The selected sections (only image sections contribute).
 */
async function planImages(
  records: ProcessExportRecord[],
  sections: Set<ExportSection>,
): Promise<ImagePlan> {
  const planned = new Set<string>();
  const order: string[] = [];
  let truncated = false;

  const consider = (photos: VehicleProcessPhotoDetailDto[]): void => {
    for (const photo of photos) {
      if (isPdfKey(photo.imageName) || planned.has(photo.imageName)) continue;
      if (order.length >= MAX_EMBEDDED_IMAGES) {
        truncated = true;
        return;
      }
      planned.add(photo.imageName);
      order.push(photo.imageName);
    }
  };

  for (const record of records) {
    if (sections.has('documents')) consider(sectionPhotos(record, 'documents'));
    if (sections.has('vehicleImages')) consider(sectionPhotos(record, 'vehicleImages'));
  }

  const buffers = new Map<string, Buffer>();
  const loaded = await mapWithConcurrency(order, IMG_CONCURRENCY, (name) => loadImageForEmbed(name));
  order.forEach((name, i) => {
    const buf = loaded[i];
    if (buf) buffers.set(name, buf);
  });
  return { buffers, planned, truncated };
}

/** A photo that is a PDF, or an image whose bytes were loaded, is renderable (tile or placeholder). */
function renderablePhotos(photos: CardPhoto[], plan: ImagePlan): CardPhoto[] {
  return photos.filter((p) => p.isPdf || plan.buffers.has(p.imageName));
}

// ── data collection ──────────────────────────────────────────────────────────

/**
 * Loads the processes in range (dealer-scoped) and enriches each with details + money figures.
 * Expenses are fetched in ONE batched query; detail reads run at {@link DB_CONCURRENCY}.
 */
async function collectRecords(
  dealerId: string | null,
  dateFrom: string | null,
  dateTo: string | null,
  dateField: ExportDateField,
  statuses: VehicleProcessStatusFilter[],
  publicOrigin?: string,
): Promise<{ records: ProcessExportRecord[]; truncated: boolean }> {
  const { ids, total } = await findProcessIdsForExport(
    dealerId,
    dateFrom,
    dateTo,
    dateField,
    statuses,
    MAX_EXPORT_PROCESSES,
  );

  const expenseRows = await listProcessExpensesByProcessIds(ids);
  const expensesByProcess = new Map<string, number>();
  for (const e of expenseRows) {
    expensesByProcess.set(e.processId, (expensesByProcess.get(e.processId) ?? 0) + e.amount.toNumber());
  }

  const details = await mapWithConcurrency(ids, DB_CONCURRENCY, async (id) => {
    try {
      return await getVehicleProcessDetails(id, publicOrigin);
    } catch {
      return null;
    }
  });

  const records: ProcessExportRecord[] = [];
  details.forEach((detail, index) => {
    if (!detail) return;
    const expenseTotal = expensesByProcess.get(ids[index]) ?? 0;
    const profit =
      detail.salePrice != null && detail.purchasePrice != null
        ? detail.salePrice - detail.purchasePrice - expenseTotal
        : null;
    records.push({ details: detail, expenseTotal, profit });
  });
  return { records, truncated: total > MAX_EXPORT_PROCESSES };
}

// ── Excel generation ──────────────────────────────────────────────────────────

// Row-image layout: ONE image per column so thumbnails sit side by side. (ExcelJS converts a
// fractional image anchor using a fixed default column width, so several images anchored into one
// wide column overlap — a dedicated column per image avoids that.)
const PX_PER_CHAR = 7; // ~pixels per Excel column-width unit (Calibri 11)
const ROW_THUMB_W = 78;
const ROW_THUMB_H = 56;
const IMG_COL_WIDTH = Math.ceil((ROW_THUMB_W + 6) / PX_PER_CHAR); // ~12 chars ≈ 84px, fits one thumbnail

/** Places each embedded thumbnail in its own consecutive column, starting at `startColIndex0` (0-based). */
function placeRowImages(
  workbook: ExcelJS.Workbook,
  sheet: ExcelJS.Worksheet,
  row: number,
  startColIndex0: number,
  photos: VehicleProcessPhotoDetailDto[],
  plan: ImagePlan,
): void {
  photos.forEach((photo, i) => {
    const buf = plan.buffers.get(photo.imageName);
    if (!buf) return;
    const imageId = workbook.addImage({ base64: buf.toString('base64'), extension: 'jpeg' });
    sheet.addImage(imageId, {
      tl: { col: startColIndex0 + i + 0.06, row: row - 1 + 0.12 },
      ext: { width: ROW_THUMB_W, height: ROW_THUMB_H },
    });
  });
}

/**
 * Writes the firm letterhead (name + subtitle, then address, then mobile), each merged across the
 * sheet, and returns the next free row.
 */
function writeExcelFirmHeader(
  sheet: ExcelJS.Worksheet,
  lastCol: number,
  meta: ExportMeta,
  subtitle: string,
): number {
  let r = 1;
  const line = (text: string, font: Partial<ExcelJS.Font>, height?: number): void => {
    sheet.mergeCells(r, 1, r, lastCol);
    const cell = sheet.getCell(r, 1);
    cell.value = text;
    cell.font = font;
    cell.alignment = { vertical: 'middle' };
    if (height) sheet.getRow(r).height = height;
    r += 1;
  };
  line(
    meta.firmName ? `${meta.firmName}  —  ${subtitle}` : subtitle,
    { bold: true, size: 14, color: { argb: hexToArgb(INK) } },
    24,
  );
  if (meta.firmAddress) line(meta.firmAddress, { size: 10, color: { argb: 'FF64748B' } });
  if (meta.firmMobile) line(`Mobile: ${meta.firmMobile}`, { size: 10, color: { argb: 'FF64748B' } });
  return r;
}

/** Sets the sheet's PRINT footer (shown when printed): firm · mobile (left), Page X of Y (right). */
function applyExcelPrintFooter(sheet: ExcelJS.Worksheet, meta: ExportMeta): void {
  const leftText = [meta.firmName, meta.firmMobile].filter(Boolean).join(' · ').replace(/&/g, '&&');
  const footer = `&L${leftText}&RPage &P of &N`;
  sheet.headerFooter = { oddFooter: footer, evenFooter: footer };
}

/**
 * Builds the XLSX workbook: a SINGLE "Vehicle Processes" sheet, ONE ROW PER PROCESS — all selected
 * scalar details as columns, plus (when selected) wide "Documents" / "Vehicle Photos" columns with
 * the images embedded side by side in the same row. Firm letterhead on top; header row frozen; a
 * banded, bordered, auto-fitted table for an at-a-glance, user-friendly view.
 */
async function buildExcel(
  records: ProcessExportRecord[],
  sections: Set<ExportSection>,
  meta: ExportMeta,
  plan: ImagePlan,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'EDealer Record';
  workbook.created = new Date();
  workbook.description = `Range: ${meta.rangeLabel}${meta.truncated ? ' (capped)' : ''}`;

  const sheet = workbook.addWorksheet('Vehicle Processes');
  const columns = buildColumns(sections);
  const scalarCount = columns.length;

  // Embeddable (successfully loaded) images per record, for each selected image section. Each image
  // gets its own column, so the width is the MAX count across processes.
  const embeddable = (r: ProcessExportRecord, kind: 'documents' | 'vehicleImages'): VehicleProcessPhotoDetailDto[] =>
    sectionPhotos(r, kind).filter((p) => plan.buffers.has(p.imageName));
  const maxDocs = sections.has('documents')
    ? records.reduce((m, r) => Math.max(m, embeddable(r, 'documents').length), 0)
    : 0;
  const maxVeh = sections.has('vehicleImages')
    ? records.reduce((m, r) => Math.max(m, embeddable(r, 'vehicleImages').length), 0)
    : 0;

  // Column layout: scalar columns, then `maxDocs` Documents columns, then `maxVeh` Vehicle columns (1-based).
  const docStart = maxDocs > 0 ? scalarCount + 1 : 0;
  const vehStart = maxVeh > 0 ? scalarCount + maxDocs + 1 : 0;
  const lastCol = scalarCount + maxDocs + maxVeh;

  const colDefs: Partial<ExcelJS.Column>[] = columns.map((c) => ({ key: c.header, width: c.width }));
  for (let i = 0; i < maxDocs + maxVeh; i += 1) colDefs.push({ width: IMG_COL_WIDTH });
  sheet.columns = colDefs;

  // Firm letterhead, then the frozen header row.
  const headerRowNum = writeExcelFirmHeader(sheet, lastCol, meta, 'Vehicle Processes');
  sheet.views = [{ state: 'frozen', ySplit: headerRowNum }];

  const headerRow = sheet.getRow(headerRowNum);
  const styleHeader = (cell: ExcelJS.Cell): void => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToArgb(ACCENT) } };
    cell.alignment = { vertical: 'middle', wrapText: true };
    cell.border = thinBorder();
  };
  columns.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.header;
    styleHeader(cell);
  });
  // A single (possibly merged) group header spanning this section's image columns.
  const groupHeader = (start: number, count: number, label: string): void => {
    if (count <= 0) return;
    if (count > 1) sheet.mergeCells(headerRowNum, start, headerRowNum, start + count - 1);
    for (let c = start; c < start + count; c += 1) styleHeader(headerRow.getCell(c));
    const cell = headerRow.getCell(start);
    cell.value = label;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  };
  groupHeader(docStart, maxDocs, 'Documents');
  groupHeader(vehStart, maxVeh, 'Vehicle Photos');
  headerRow.height = 22;

  let row = headerRowNum;
  records.forEach((record, index) => {
    row += 1;
    const values = columns.map((c) => c.value(record));
    const dataRow = sheet.getRow(row);
    const zebra: ExcelJS.Fill | undefined =
      index % 2 === 1 ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } } : undefined;
    values.forEach((v, i) => {
      const cell = dataRow.getCell(i + 1);
      cell.value = v;
      cell.alignment = { vertical: 'top', wrapText: true };
      cell.border = thinBorder();
      if (zebra) cell.fill = zebra;
    });
    // Border + band the image grid so empty slots stay consistent with the data cells.
    for (let c = scalarCount + 1; c <= lastCol; c += 1) {
      const cell = dataRow.getCell(c);
      cell.border = thinBorder();
      if (zebra) cell.fill = zebra;
    }

    const docPhotos = maxDocs > 0 ? embeddable(record, 'documents') : [];
    const vehPhotos = maxVeh > 0 ? embeddable(record, 'vehicleImages') : [];
    const longest = values.reduce((m, v) => Math.max(m, String(v || '').length), 0);
    const textHeight = longest > 30 ? Math.min(Math.ceil(longest / 30) * 15, 90) : 0;
    const imageHeight = docPhotos.length || vehPhotos.length ? Math.round(ROW_THUMB_H * 0.75) + 8 : 0;
    const rowHeight = Math.max(textHeight, imageHeight);
    if (rowHeight) dataRow.height = rowHeight;

    if (docPhotos.length) placeRowImages(workbook, sheet, row, docStart - 1, docPhotos, plan);
    if (vehPhotos.length) placeRowImages(workbook, sheet, row, vehStart - 1, vehPhotos, plan);
  });

  if (records.length === 0) sheet.getCell(headerRowNum + 1, 1).value = 'No processes in the selected range.';

  // Auto-fit the SCALAR columns (skip the merged firm-letterhead rows); keep fixed image-column widths.
  autosizeColumns(sheet, columns.map((c) => c.width), headerRowNum - 1);
  for (let c = scalarCount + 1; c <= lastCol; c += 1) sheet.getColumn(c).width = IMG_COL_WIDTH;

  applyExcelPrintFooter(sheet, meta);

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

// ── PDF generation (modern per-process cards) ────────────────────────────────

/** Draws one label/value cell (stacked): small muted label over a bold value (the value may wrap). */
function drawFieldCell(doc: PDFKit.PDFDocument, x: number, y: number, w: number, field: Field): void {
  doc.font('Helvetica').fontSize(6.5).fillColor(MUTED).text(field.label.toUpperCase(), x, y, {
    width: w,
    lineBreak: false,
    ellipsis: true,
    characterSpacing: 0.3,
  });
  // Value wraps within the column (addresses can be long); the caller measures the height first.
  doc.font('Helvetica-Bold').fontSize(9).fillColor(INK).text(field.value || '—', x, y + 9, { width: w });
}

/** How a card is being laid out: for real, or on the scratch document that only measures it. */
interface CardPass {
  /** False on the measuring pass: image tiles keep their size, but no image bytes are embedded. */
  paintImages: boolean;
}

/**
 * Draws a modern card for one process: header band, grouped detail fields, then an image strip.
 *
 * The caller decides where a card starts (see {@link buildPdf}: a card that does not fit in what is
 * left of the page starts on a new one), so a page break INSIDE this function only happens for a card
 * taller than a whole page. Such a break is labelled "<reg> — continued" at the top of the next page.
 *
 * @returns The lowest y the card asked its page to reach, i.e. the room it needs to be drawn in one
 *   piece. That is less than where its divider ends: the gap and divider after the last row are simply
 *   dropped at a page bottom. Only meaningful when the card did not break (the measuring pass).
 */
function drawPdfCard(
  doc: PDFKit.PDFDocument,
  record: ProcessExportRecord,
  sections: Set<ExportSection>,
  plan: ImagePlan,
  left: number,
  usableWidth: number,
  pass: CardPass,
): number {
  const bottom = (): number => doc.page.height - doc.page.margins.bottom;
  // Every "does this still fit on the page?" test goes through here, so the measuring pass learns
  // exactly how far down a page the card must reach to be drawn without a break.
  let reach = doc.y;
  const overflows = (y: number): boolean => {
    reach = Math.max(reach, y);
    return y > bottom();
  };
  const d = record.details;
  const reg = d.vehicle?.registrationNumber ?? '—';
  // Continue an over-tall card on the next page, saying which process the rest belongs to.
  const continueOnNextPage = (): void => {
    doc.addPage();
    const labelY = doc.y;
    doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED).text(`${reg} — continued`, left, labelY, {
      width: usableWidth,
      characterSpacing: 0.5,
      lineBreak: false,
      ellipsis: true,
    });
    // A single-line text call does not move the cursor down, so place it explicitly below the label.
    doc.x = left;
    doc.y = labelY + 18;
  };
  const ensure = (needed: number): void => {
    if (overflows(doc.y + needed)) continueOnNextPage();
  };
  const makeModelText = makeModel(d.vehicle);
  const statusTxt = fmtStatus(d.status);
  const statusCol = statusHex(d.status);

  // Reserve the header band PLUS its first child, so a header is never left orphaned at a page bottom
  // with its content on the next page. The same "header + first child" rule guards the group titles
  // and the images heading below.
  const groups = detailGroups(record, sections);
  const photos = renderablePhotos(cardPhotos(record, sections), plan);
  const HEADER_BODY = 40; // header band + gap (doc.y advances hy → hy+40)
  const TITLE_RESERVE = 16; // group-title line + spacing
  const IMAGES_FIRST = 150; // "DOCUMENTS & PHOTOS" heading + the first thumbnail row (120 + 12 + gaps)

  // Two-column field geometry — needed up front to measure the first row for orphan reservation.
  const colGap = 18;
  const colW = (usableWidth - colGap) / 2;
  // Row height for a label+value pair, accounting for wrapped (multi-line) values.
  const measureRowH = (f1: Field, f2?: Field): number => {
    doc.font('Helvetica-Bold').fontSize(9);
    const h1 = 9 + doc.heightOfString(f1.value || '—', { width: colW });
    const h2 = f2 ? 9 + doc.heightOfString(f2.value || '—', { width: colW }) : 0;
    return Math.max(h1, h2, 20);
  };
  // Reserve the header band + its first child (a group's title + its MEASURED first row, or the first
  // image row) so neither the card header nor a group title is orphaned at a page bottom — even when
  // the first field value wraps to multiple lines.
  const firstGroup = groups[0];
  const firstContentMin = firstGroup
    ? TITLE_RESERVE + measureRowH(firstGroup.fields[0], firstGroup.fields[1]) + 4
    : photos.length
      ? IMAGES_FIRST
      : 12;

  // Header band. (A plain page break here, not a "continued" one: nothing of this card is drawn yet.)
  if (overflows(doc.y + HEADER_BODY + firstContentMin)) doc.addPage();
  const hy = doc.y;
  doc.roundedRect(left, hy, usableWidth, 32, 7).fill(HEADER_BG);
  doc.rect(left, hy + 2, 4, 28).fill(statusCol);
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(13).text(reg, left + 14, hy + 6, {
    width: usableWidth - 150,
    lineBreak: false,
  });
  if (makeModelText) {
    doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(makeModelText, left + 14, hy + 20, {
      width: usableWidth - 150,
      lineBreak: false,
    });
  }
  doc.font('Helvetica-Bold').fontSize(8);
  const pillW = doc.widthOfString(statusTxt) + 18;
  const pillX = left + usableWidth - pillW - 10;
  doc.roundedRect(pillX, hy + 8, pillW, 16, 8).fill(statusCol);
  doc.fillColor('#ffffff').text(statusTxt, pillX, hy + 12, { width: pillW, align: 'center' });
  doc.y = hy + 40;
  doc.x = left;

  // Detail groups in two columns.
  for (const group of groups) {
    // Keep the group title together with its first field row (whose height may exceed one line).
    ensure(TITLE_RESERVE + measureRowH(group.fields[0], group.fields[1]) + 4);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(ACCENT).text(group.title.toUpperCase(), left, doc.y, {
      characterSpacing: 0.5,
    });
    doc.moveDown(0.25);
    for (let i = 0; i < group.fields.length; i += 2) {
      const f1 = group.fields[i];
      const f2 = group.fields[i + 1];
      const rowH = measureRowH(f1, f2);
      ensure(rowH + 4);
      const gy = doc.y;
      drawFieldCell(doc, left, gy, colW, f1);
      if (f2) drawFieldCell(doc, left + colW + colGap, gy, colW, f2);
      doc.y = gy + rowH + 4;
      doc.x = left;
    }
    doc.moveDown(0.3);
  }

  // Documents + vehicle photos together.
  if (photos.length) {
    ensure(IMAGES_FIRST);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(ACCENT).text('DOCUMENTS & PHOTOS', left, doc.y, {
      characterSpacing: 0.5,
    });
    doc.moveDown(0.3);
    const tW = 165;
    const tH = 120;
    const capH = 13;
    const gap = 4; // minimal spacing between images
    const perRow = Math.max(1, Math.floor((usableWidth + gap) / (tW + gap)));
    let col = 0;
    let rowY = doc.y;
    for (const photo of photos) {
      if (col === perRow) {
        col = 0;
        rowY += tH + capH + gap;
      }
      if (overflows(rowY + tH + capH)) {
        continueOnNextPage();
        rowY = doc.y;
        col = 0;
      }
      const x = left + col * (tW + gap);
      const buf = plan.buffers.get(photo.imageName);
      if (buf) {
        // Center the image within its tile so the centered caption below lines up with it. (The
        // measuring pass skips the bytes; the tile's size does not depend on them.)
        if (pass.paintImages) doc.image(buf, x, rowY, { fit: [tW, tH], align: 'center', valign: 'center' });
      } else {
        doc.roundedRect(x, rowY, tW, tH, 4).fill('#f8fafc');
        doc.fillColor('#94a3b8').font('Helvetica-Bold').fontSize(11).text('PDF', x, rowY + tH / 2 - 6, {
          width: tW,
          align: 'center',
        });
      }
      // `height` is what makes this a single line cut with an ellipsis: without it pdfkit wraps a
      // long category and, near the page bottom, adds a page of its own in the middle of the card.
      doc.font('Helvetica').fontSize(7).fillColor(MUTED).text(photo.category || '', x, rowY + tH + 2, {
        width: tW,
        height: capH - 2,
        align: 'center',
        ellipsis: true,
        lineBreak: false,
      });
      col += 1;
    }
    doc.y = rowY + tH + capH + gap;
    doc.x = left;
  }

  // Divider between cards. If it no longer fits (an over-tall card ending at the page bottom), the
  // page break that follows separates the cards instead — never a new page for a line alone.
  if (doc.y + 12 > bottom()) return reach;
  doc.moveTo(left, doc.y).lineTo(left + usableWidth, doc.y).strokeColor(LINE).lineWidth(1).stroke();
  doc.moveDown(0.9);
  return reach;
}

/**
 * Returns a function that measures how much room a record's card needs to be drawn in one piece.
 *
 * It lays the card out with the very same {@link drawPdfCard}, on a scratch document whose page is
 * far taller than any card (so nothing breaks) and whose output is thrown away. Measuring with the
 * drawing code itself keeps the two in step by construction — wrapped addresses, dropped groups and
 * image rows included — instead of maintaining a second copy of the layout arithmetic.
 */
function createCardMeasurer(
  sections: Set<ExportSection>,
  plan: ImagePlan,
  left: number,
  usableWidth: number,
  pageWidth: number,
  margin: number,
): { measure: (record: ProcessExportRecord) => number; dispose: () => void } {
  const scratch = new PDFDocument({ size: [pageWidth, 100_000], margin, autoFirstPage: false });
  scratch.on('data', () => undefined); // nothing is kept
  return {
    measure: (record): number => {
      scratch.addPage(); // a fresh page per card; the previous one is flushed and discarded
      const top = scratch.y;
      return drawPdfCard(scratch, record, sections, plan, left, usableWidth, { paintImages: false }) - top;
    },
    dispose: (): void => scratch.end(),
  };
}

/**
 * Draws the page footer on the CURRENT page: firm name · mobile (left), "Page X" (right), above a
 * thin rule. Called from the `pageAdded` handler so every page is stamped as it is created (robust
 * against pdfkit's page buffering). Graphics state is saved/restored; the caller restores the cursor.
 */
function drawPdfFooter(doc: PDFKit.PDFDocument, pageNum: number, meta: ExportMeta): void {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const y = doc.page.height - 26;
  // The footer sits in the bottom margin; temporarily drop that margin so pdfkit doesn't try to
  // paginate (which, from inside pageAdded, would recurse) while rendering text below the content area.
  const savedBottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc.save();
  doc.moveTo(left, y - 5).lineTo(right, y - 5).strokeColor(LINE).lineWidth(0.5).stroke();
  doc.font('Helvetica').fontSize(8).fillColor(MUTED);
  const leftText = [meta.firmName, meta.firmMobile].filter(Boolean).join(' · ');
  if (leftText) doc.text(leftText, left, y, { width: right - left - 90, lineBreak: false, ellipsis: true });
  doc.text(`Page ${pageNum}`, left, y, { width: right - left, align: 'right', lineBreak: false });
  doc.restore();
  doc.page.margins.bottom = savedBottom;
}

/** Builds a modern, portrait PDF: a cover header, one styled card per process, and page footers. */
async function buildPdf(
  records: ProcessExportRecord[],
  sections: Set<ExportSection>,
  meta: ExportMeta,
  plan: ImagePlan,
): Promise<Buffer> {
  // autoFirstPage off so the pageAdded footer handler also stamps the very first page.
  const doc = new PDFDocument({ size: 'A4', margin: 36, autoFirstPage: false });
  const chunks: Uint8Array[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Uint8Array) => {
      chunks.push(chunk);
    });
    doc.on('end', () => resolve(Buffer.from(Buffer.concat(chunks))));
    doc.on('error', reject);
  });

  // Stamp the footer on EVERY page as it is created (robust vs. page buffering). The handler runs
  // right after a page is added (cursor at the top margin); save/restore the cursor so content keeps
  // flowing from the top.
  let pageNum = 0;
  let cardsOnPage = 0; // cards started or continued on the current page (the letterhead does not count)
  let stamping = false; // guard against any re-entrant pageAdded while drawing the footer
  doc.on('pageAdded', () => {
    if (stamping) return;
    stamping = true;
    pageNum += 1;
    cardsOnPage = 0;
    const savedX = doc.x;
    const savedY = doc.y;
    drawPdfFooter(doc, pageNum, meta);
    doc.x = savedX;
    doc.y = savedY;
    stamping = false;
  });
  doc.addPage();

  const left = doc.page.margins.left;
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  // Cover header — the dealer's firm letterhead (name + address + mobile), then the export summary.
  doc.rect(0, 0, doc.page.width, 6).fill(ACCENT);
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(20).text(meta.firmName || 'Vehicle Process Export', left, 42);
  if (meta.firmAddress) {
    doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(meta.firmAddress, left);
  }
  if (meta.firmMobile) {
    doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(`Mobile: ${meta.firmMobile}`, left);
  }
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(MUTED)
    .text(`${meta.firmName ? 'Vehicle Process Export · ' : ''}${records.length} process(es) · ${meta.rangeLabel}`, left);
  if (meta.truncated) {
    doc.fillColor('#b45309').fontSize(9).text('Some rows/images were capped; narrow the date range for the rest.');
  }
  doc.moveDown(1);
  doc.fillColor(INK);

  if (records.length === 0) {
    doc.font('Helvetica').fontSize(11).fillColor(MUTED).text('No processes in the selected range.');
  }

  // Keep every process in one piece: a card that does not fit in what is left of the page starts on
  // a new page rather than being cut in two. Only a card taller than a whole page can still run
  // over; it starts on a page with no other card and its overflow is labelled "continued".
  const pageTop = doc.page.margins.top;
  const pageBottom = doc.page.height - doc.page.margins.bottom;
  const SLACK = 0.01; // the scratch and real pages add the same numbers from different starting points
  const measurer = createCardMeasurer(sections, plan, left, usableWidth, doc.page.width, doc.page.margins.left);
  for (const record of records) {
    const needed = measurer.measure(record);
    if (doc.y + needed > pageBottom - SLACK) {
      // A new page helps unless we are already at the top of one — or the card is too tall for any
      // page and this one holds no card yet (page 1 under the letterhead): it must run over either
      // way, and moving it on would only leave the first page nearly empty.
      const atPageTop = doc.y <= pageTop + 0.5;
      const tooTallForAnyPage = pageTop + needed > pageBottom - SLACK;
      if (!atPageTop && !(tooTallForAnyPage && cardsOnPage === 0)) doc.addPage();
    }
    drawPdfCard(doc, record, sections, plan, left, usableWidth, { paintImages: true });
    cardsOnPage += 1;
  }
  measurer.dispose();

  doc.end();
  return done;
}

// ── entry point ───────────────────────────────────────────────────────────────

/**
 * Resolves the effective processDate range: the given bounds, or the current month when BOTH are
 * absent (the page's default). Returns ISO bounds for the repository plus a human label.
 */
function resolveRange(
  dateFrom?: string | null,
  dateTo?: string | null,
): { from: string | null; to: string | null; label: string } {
  if (dateFrom || dateTo) {
    return {
      from: dateFrom ?? null,
      to: dateTo ?? null,
      label: `${fmtDate(dateFrom) || '…'} – ${fmtDate(dateTo) || '…'}`,
    };
  }
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return {
    from: start.toISOString(),
    to: end.toISOString(),
    label: `${fmtDate(start)} – ${fmtDate(end)} (current month)`,
  };
}

function fileStamp(): string {
  const now = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
}

/**
 * Generates a dealer-scoped vehicle-process export over a processDate range (current month by
 * default) as an Excel workbook or PDF, including only the selected sections. Work is bounded (at
 * most {@link MAX_EXPORT_PROCESSES} processes, {@link MAX_EMBEDDED_IMAGES} images; DB reads and
 * transcodes at bounded concurrency). Returns the file buffer plus Content-Type / filename.
 *
 * @param params - Resolved dealer, format, range, sections, and request origin.
 */
export async function exportProcesses(params: ExportParams): Promise<ExportResult> {
  const { from, to, label } = resolveRange(params.dateFrom, params.dateTo);
  const { records, truncated: processTruncated } = await collectRecords(
    params.dealerId,
    from,
    to,
    params.dateField,
    params.statuses,
    params.publicOrigin,
  );

  const needsImages = params.sections.has('documents') || params.sections.has('vehicleImages');
  const plan: ImagePlan = needsImages
    ? await planImages(records, params.sections)
    : { buffers: new Map(), planned: new Set(), truncated: false };

  // The current user's firm letterhead (name + address + mobile); all null for an all-dealers export.
  let firmName: string | null = null;
  let firmAddress: string | null = null;
  let firmMobile: string | null = null;
  if (params.dealerId) {
    const dealer = await findDealerById(params.dealerId);
    firmName = dealer?.firmName ?? null;
    firmMobile = dealer?.mobileNo ?? null;
    // Format: "Address - State - City - Pincode" (dash-separated), omitting any missing part.
    const addr = [dealer?.address, dealer?.state, dealer?.city, dealer?.pincode]
      .map((p) => p?.trim())
      .filter((p): p is string => Boolean(p))
      .join(' - ');
    firmAddress = addr || null;
  }

  const truncated = processTruncated || plan.truncated;
  const meta: ExportMeta = { rangeLabel: label, truncated, firmName, firmAddress, firmMobile };

  const buffer =
    params.format === 'excel'
      ? await buildExcel(records, params.sections, meta, plan)
      : await buildPdf(records, params.sections, meta, plan);

  const ext = params.format === 'excel' ? 'xlsx' : 'pdf';
  return {
    buffer,
    filename: `vehicle-processes_${fileStamp()}.${ext}`,
    contentType: params.format === 'excel' ? EXCEL_MIME : PDF_MIME,
    count: records.length,
    truncated,
  };
}
