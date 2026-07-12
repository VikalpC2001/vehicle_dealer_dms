import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import {
  createPerson,
  listPersonsByProcess,
  getPersonById,
  updatePerson,
  deletePerson,
} from '../services/person.service';
import { sendSuccess } from '../utils/api-response';
import { resolveDealerIdFromRequest } from '../utils/dealer-scope';
import type {
  CreatePersonBody,
  UpdatePersonBody,
  PersonIdParams,
} from '../validations/person.validation';

/**
 * POST /persons
 */
export async function createPersonHandler(req: Request, res: Response): Promise<void> {
  const body = req.body as CreatePersonBody;
  const { dealerId: bodyDealerId, ...rest } = body;
  const dealerId = resolveDealerIdFromRequest(req, bodyDealerId);
  const row = await createPerson(dealerId, rest);
  sendSuccess(res, 'Person created', row, StatusCodes.CREATED);
}

/**
 * GET /persons?processId=
 */
export async function listPersonsHandler(req: Request, res: Response): Promise<void> {
  const q = req.query as { processId: string; dealerId?: string };
  const dealerId = resolveDealerIdFromRequest(req, q.dealerId);
  const items = await listPersonsByProcess(dealerId, q.processId);
  sendSuccess(res, 'Persons retrieved', items);
}

/**
 * GET /persons/:id
 */
export async function getPersonByIdHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as PersonIdParams;
  const q = req.query as { dealerId?: string };
  const dealerId = resolveDealerIdFromRequest(req, q.dealerId);
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
  const dealerId = resolveDealerIdFromRequest(req, q.dealerId);
  const row = await updatePerson(dealerId, id, body);
  sendSuccess(res, 'Person updated', row);
}

/**
 * DELETE /persons/:id
 */
export async function deletePersonHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as PersonIdParams;
  const q = req.query as { dealerId?: string };
  const dealerId = resolveDealerIdFromRequest(req, q.dealerId);
  await deletePerson(dealerId, id);
  sendSuccess(res, 'Person deleted', {});
}
