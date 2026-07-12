import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import {
  createState,
  listStates,
  listStatesForDropdown,
  getStateById,
  updateState,
  deleteState,
} from '../services/state.service';
import { sendSuccess } from '../utils/api-response';
import type { PaginationQuery } from '../types';
import type { CreateStateBody, UpdateStateBody, StateIdParams } from '../validations/state.validation';

export async function createStateHandler(req: Request, res: Response): Promise<void> {
  const body = req.body as CreateStateBody;
  const state = await createState(body);
  sendSuccess(res, 'State created', state, StatusCodes.CREATED);
}

export async function listStatesHandler(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as PaginationQuery;
  const result = await listStates(query);
  sendSuccess(res, 'States retrieved', result);
}

export async function listStatesForDropdownHandler(_req: Request, res: Response): Promise<void> {
  const items = await listStatesForDropdown();
  sendSuccess(res, 'States retrieved', items);
}

export async function getStateByIdHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as StateIdParams;
  const state = await getStateById(id);
  sendSuccess(res, 'State retrieved', state);
}

export async function updateStateHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as StateIdParams;
  const body = req.body as UpdateStateBody;
  const state = await updateState(id, body);
  sendSuccess(res, 'State updated', state);
}

export async function deleteStateHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as StateIdParams;
  await deleteState(id);
  sendSuccess(res, 'State deleted', {});
}

