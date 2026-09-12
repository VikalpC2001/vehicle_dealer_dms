import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import {
  createPerson,
  listPersonsByProcess,
  getPersonById,
  updatePerson,
  deletePerson,
  changeBuyer,
} from '../services/person.service';
import { sendSuccess } from '../utils/api-response';
import { resolveManagedDealerId } from '../utils/managed-dealer-scope';
import { resolveUploadPublicOrigin } from '../utils/request-origin';
import type {
  CreatePersonBody,
  UpdatePersonBody,
  PersonIdParams,
  ChangeBuyerBody,
} from '../validations/person.validation';

/**
 * POST /persons
 */
export async function createPersonHandler(req: Request, res: Response): Promise<void> {
  const body = req.body as CreatePersonBody;
  const { dealerId: bodyDealerId, ...rest } = body;
  const dealerId = await resolveManagedDealerId(req, bodyDealerId, { gateSubscription: false });
  const row = await createPerson(dealerId, rest);
  sendSuccess(res, 'Person created', row, StatusCodes.CREATED);
}

/**
 * GET /persons?processId=
 */
export async function listPersonsHandler(req: Request, res: Response): Promise<void> {
  const q = req.query as { processId: string; dealerId?: string };
  const dealerId = await resolveManagedDealerId(req, q.dealerId, { gateSubscription: false });
  const items = await listPersonsByProcess(dealerId, q.processId, resolveUploadPublicOrigin(req));
  sendSuccess(res, 'Persons retrieved', items);
}

/**
 * POST /persons/change-buyer — cancel the current active buyer (kept for history with their ID) and
 * add a new buyer, optionally with a new ID photo. Dealer- or managing-agent-scoped.
 */
export async function changeBuyerHandler(req: Request, res: Response): Promise<void> {
  const body = req.body as ChangeBuyerBody;
  const { dealerId: bodyDealerId, processId, ...rest } = body;
  const dealerId = await resolveManagedDealerId(req, bodyDealerId, { gateSubscription: false });
  const buyer = await changeBuyer(dealerId, processId, rest);
  sendSuccess(res, 'Buyer changed', buyer, StatusCodes.CREATED);
}

/**
 * GET /persons/:id
 */
export async function getPersonByIdHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as PersonIdParams;
  const q = req.query as { dealerId?: string };
  const dealerId = await resolveManagedDealerId(req, q.dealerId, { gateSubscription: false });
  const row = await getPersonById(dealerId, id);
  sendSuccess(res, 'Person retrieved', row);
}

/**
 * PATCH /persons/:id
 */
export async function updatePersonHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as PersonIdParams;
  const body = req.body as UpdatePersonBody;
  const q = req.query as { dealerId?: string };
  const dealerId = await resolveManagedDealerId(req, q.dealerId, { gateSubscription: false });
  const row = await updatePerson(dealerId, id, body);
  sendSuccess(res, 'Person updated', row);
}

/**
 * DELETE /persons/:id
 */
export async function deletePersonHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as PersonIdParams;
  const q = req.query as { dealerId?: string };
  const dealerId = await resolveManagedDealerId(req, q.dealerId, { gateSubscription: false });
  await deletePerson(dealerId, id);
  sendSuccess(res, 'Person deleted', {});
}
