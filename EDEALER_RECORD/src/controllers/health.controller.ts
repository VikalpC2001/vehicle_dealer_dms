import type { Request, Response } from 'express';
import { checkReadiness } from '../services/health.service';
import { sendSuccess } from '../utils/api-response';

/**
 * GET /health/ready
 * Readiness: 200 when the database answers, 503/5030 otherwise. No authentication.
 */
export async function readinessHandler(_req: Request, res: Response): Promise<void> {
  const result = await checkReadiness();
  sendSuccess(res, 'Ready', result);
}
