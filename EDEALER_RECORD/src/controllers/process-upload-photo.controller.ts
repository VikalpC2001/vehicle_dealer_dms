import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import {
  createProcessUploadPhoto,
  createManyProcessUploadPhotos,
  listProcessUploadPhotosByProcess,
  getProcessUploadPhotoById,
  updateProcessUploadPhoto,
  setStarredVehiclePhoto,
  deleteProcessUploadPhoto,
} from '../services/process-upload-photo.service';
import { sendSuccess } from '../utils/api-response';
import { resolveManagedDealerId } from '../utils/managed-dealer-scope';
import type {
  CreateProcessUploadPhotoBody,
  BulkCreateProcessUploadPhotosBody,
  UpdateProcessUploadPhotoBody,
  ProcessUploadPhotoIdParams,
} from '../validations/process-upload-photo.validation';

/**
 * POST /process-upload-photos
 */
export async function createProcessUploadPhotoHandler(req: Request, res: Response): Promise<void> {
  const body = req.body as CreateProcessUploadPhotoBody;
  const { dealerId: bodyDealerId, ...rest } = body;
  const dealerId = await resolveManagedDealerId(req, bodyDealerId, { gateSubscription: false });
  const row = await createProcessUploadPhoto(dealerId, rest);
  sendSuccess(res, 'Process upload photo created', row, StatusCodes.CREATED);
}

/**
 * POST /process-upload-photos/bulk
 */
export async function bulkCreateProcessUploadPhotosHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const body = req.body as BulkCreateProcessUploadPhotosBody;
  const { dealerId: bodyDealerId, items } = body;
  const dealerId = await resolveManagedDealerId(req, bodyDealerId, { gateSubscription: false });
  const rows = await createManyProcessUploadPhotos(dealerId, items);
  sendSuccess(res, 'Process upload photos created', { items: rows }, StatusCodes.CREATED);
}

/**
 * GET /process-upload-photos?processId=
 */
export async function listProcessUploadPhotosHandler(req: Request, res: Response): Promise<void> {
  const q = req.query as { processId: string; dealerId?: string };
  const dealerId = await resolveManagedDealerId(req, q.dealerId, { gateSubscription: false });
  const items = await listProcessUploadPhotosByProcess(dealerId, q.processId);
  sendSuccess(res, 'Process upload photos retrieved', items);
}

/**
 * GET /process-upload-photos/:id
 */
export async function getProcessUploadPhotoByIdHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as ProcessUploadPhotoIdParams;
  const q = req.query as { dealerId?: string };
  const dealerId = await resolveManagedDealerId(req, q.dealerId, { gateSubscription: false });
  const row = await getProcessUploadPhotoById(dealerId, id);
  sendSuccess(res, 'Process upload photo retrieved', row);
}

/**
 * PATCH /process-upload-photos/:id
 */
export async function updateProcessUploadPhotoHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as ProcessUploadPhotoIdParams;
  const body = req.body as UpdateProcessUploadPhotoBody;
  const q = req.query as { dealerId?: string };
  const dealerId = await resolveManagedDealerId(req, q.dealerId, { gateSubscription: false });
  const row = await updateProcessUploadPhoto(dealerId, id, body);
  sendSuccess(res, 'Process upload photo updated', row);
}

/**
 * PATCH /process-upload-photos/:id/star
 */
export async function setStarredVehiclePhotoHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as ProcessUploadPhotoIdParams;
  const q = req.query as { dealerId?: string };
  const dealerId = await resolveManagedDealerId(req, q.dealerId, { gateSubscription: false });
  const row = await setStarredVehiclePhoto(dealerId, id);
  sendSuccess(res, 'Vehicle photo starred', row);
}

/**
 * DELETE /process-upload-photos/:id
 */
export async function deleteProcessUploadPhotoHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as ProcessUploadPhotoIdParams;
  const q = req.query as { dealerId?: string };
  const dealerId = await resolveManagedDealerId(req, q.dealerId, { gateSubscription: false });
  await deleteProcessUploadPhoto(dealerId, id);
  sendSuccess(res, 'Process upload photo deleted', {});
}
