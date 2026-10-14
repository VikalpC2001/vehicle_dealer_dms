import type { Request, Response } from 'express';
import { exportProcesses } from '../services/process-export.service';
import { parseExportSections, parseExportStatuses } from '../validations/process-export.validation';
import type { ExportProcessesQuery } from '../validations/process-export.validation';
import { resolveManagedDealerId } from '../utils/managed-dealer-scope';
import { resolveUploadPublicOrigin } from '../utils/request-origin';

/**
 * GET /vehicle-processes/export — stream an Excel or PDF export of the caller's vehicle processes
 * over a processDate range (current month by default), including only the selected sections. Streams
 * a binary file (bypasses the JSON `sendSuccess` envelope). Dealer-scoped: a dealer exports their own
 * processes; an agent/super-admin passes a `dealerId` they manage.
 */
export async function exportProcessesHandler(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as ExportProcessesQuery;
  const dealerId = await resolveManagedDealerId(req, query.dealerId, { gateSubscription: false });
  const sections = parseExportSections(query.sections);
  const statuses = parseExportStatuses(query.statuses);
  const publicOrigin = resolveUploadPublicOrigin(req);

  const { buffer, filename, contentType, count, truncated } = await exportProcesses({
    dealerId,
    format: query.format,
    dateFrom: query.dateFrom ?? null,
    dateTo: query.dateTo ?? null,
    dateField: query.dateField ?? 'processDate',
    statuses,
    sections,
    publicOrigin,
  });

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', buffer.length);
  // Expose our informational headers to the browser fetch (so the SPA can surface count/truncation).
  res.setHeader('X-Export-Count', String(count));
  res.setHeader('X-Export-Truncated', String(truncated));
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-Export-Count, X-Export-Truncated');
  res.status(200).send(buffer);
}
