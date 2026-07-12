import { StatusCodes } from 'http-status-codes';
import type { State } from '@prisma/client';
import * as stateRepository from '../repositories/state.repository';
import { AppError } from '../utils/app-error';
import { parsePagination, buildPaginationMeta } from '../utils/pagination';
import type { PaginationQuery, PaginatedResult } from '../types';
import type { StateDropdownItem } from '../repositories/state.repository';

export interface CreateStateInput {
  stateName: string;
}

export interface UpdateStateInput {
  stateName: string;
}

export async function createState(input: CreateStateInput): Promise<State> {
  const existing = await stateRepository.findStateByName(input.stateName);
  if (existing) {
    throw new AppError('State name already exists', StatusCodes.CONFLICT, 4103);
  }
  return stateRepository.createState({ stateName: input.stateName });
}

export async function listStates(query: PaginationQuery): Promise<PaginatedResult<State>> {
  const { skip, take } = parsePagination(query);
  const { items, total } = await stateRepository.listStates(skip, take);
  const meta = buildPaginationMeta(total, query);
  return { data: items, meta };
}

export async function listStatesForDropdown(): Promise<StateDropdownItem[]> {
  return stateRepository.listStatesForDropdown();
}

export async function getStateById(stateId: string): Promise<State> {
  const state = await stateRepository.findStateById(stateId);
  if (!state) {
    throw new AppError('State not found', StatusCodes.NOT_FOUND, 4048);
  }
  return state;
}

export async function updateState(stateId: string, input: UpdateStateInput): Promise<State> {
  await getStateById(stateId);
  const existing = await stateRepository.findStateByName(input.stateName, stateId);
  if (existing) {
    throw new AppError('State name already exists', StatusCodes.CONFLICT, 4103);
  }
  return stateRepository.updateState(stateId, { stateName: input.stateName });
}

export async function deleteState(stateId: string): Promise<void> {
  await getStateById(stateId);
  await stateRepository.deleteState(stateId);
}

