import { z } from 'zod';

/**
 * Selectable export sections. Each maps to a group of columns / image sets in the generated file:
 * - `vehicle`       — vehicle identity (reg no, make/model, mfg, chassis, engine, type, reg date)
 * - `persons`       — active seller & buyer (name + mobile + address)
 * - `deal`          — deal number, lifecycle status, process/sold dates, seller/buyer references
 * - `amount`        — purchase/sale price, total expenses, computed profit
 * - `documents`     — DOCUMENT-kind images (embedded)
 * - `vehicleImages` — VEHICLE-kind photos (embedded)
 */
export const EXPORT_SECTIONS = [
  'vehicle',
  'persons',
  'deal',
  'amount',
  'documents',
  'vehicleImages',
] as const;

export type ExportSection = (typeof EXPORT_SECTIONS)[number];

/**
 * GET /vehicle-processes/export query schema. `sections` is a comma-separated list of
 * {@link EXPORT_SECTIONS} keys (the controller parses + filters it, defaulting to ALL when empty, so
 * unknown keys are ignored rather than rejected). `dateFrom`/`dateTo` range `processDate` (inclusive);
 * when both are absent the service defaults to the current month. `dealerId` follows the same
 * managed-dealer passthrough as the list endpoint (ignored for a dealer caller).
 */
export const exportProcessesSchema = z.object({
  query: z.object({
    format: z.enum(['excel', 'pdf'], {
      required_error: 'format is required',
      invalid_type_error: 'format must be excel or pdf',
    }),
    dealerId: z.string().uuid('Invalid dealer ID').optional(),
    dateFrom: z.string().datetime('Invalid dateFrom').optional(),
    dateTo: z.string().datetime('Invalid dateTo').optional(),
    // Which date column the range filters on: 'processDate' (default) or 'soldDate'.
    dateField: z.enum(['processDate', 'soldDate']).optional(),
    // Comma-separated lifecycle statuses to include (OPEN/SOLD/COMPLETE/SCRAP); empty/all = every status.
    statuses: z.string().max(100).optional(),
    sections: z.string().max(200).optional(),
  }),
});

export type ExportProcessesQuery = z.infer<typeof exportProcessesSchema>['query'];

/**
 * Parses the comma-separated `sections` query into a de-duplicated set of valid sections. Unknown
 * tokens are dropped; an empty/absent value yields ALL sections (export everything by default).
 *
 * @param raw - The raw `sections` query string (e.g. `"vehicle,persons,documents"`).
 */
export function parseExportSections(raw: string | undefined): Set<ExportSection> {
  const known = new Set<string>(EXPORT_SECTIONS);
  const picked = (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is ExportSection => known.has(s));
  return picked.length > 0 ? new Set(picked) : new Set(EXPORT_SECTIONS);
}

/** The selectable lifecycle statuses for the export filter. Mirrors the repository's filter union. */
export const EXPORT_STATUSES = ['OPEN', 'SOLD', 'COMPLETE', 'SCRAP'] as const;
export type ExportStatus = (typeof EXPORT_STATUSES)[number];

/**
 * Parses the comma-separated `statuses` query into a de-duplicated list of valid statuses. Unknown
 * tokens are dropped; an empty/absent value (or all four) yields an empty list = "every status".
 *
 * @param raw - The raw `statuses` query string (e.g. `"OPEN,SOLD"`).
 */
export function parseExportStatuses(raw: string | undefined): ExportStatus[] {
  const known = new Set<string>(EXPORT_STATUSES);
  const picked = (raw ?? '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((s): s is ExportStatus => known.has(s));
  return [...new Set(picked)];
}
