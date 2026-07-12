import { prisma } from '../config/prisma';
import type { State } from '@prisma/client';

export type StateDropdownItem = Pick<State, 'stateId' | 'stateName'>;

export interface CreateStateData {
  stateName: string;
}

export interface UpdateStateData {
  stateName: string;
}

export async function createState(data: CreateStateData): Promise<State> {
  return prisma.state.create({ data });
}

export async function listStates(skip: number, take: number): Promise<{ items: State[]; total: number }> {
  const [items, total] = await Promise.all([
    prisma.state.findMany({ skip, take, orderBy: { stateName: 'asc' } }),
    prisma.state.count(),
  ]);
  return { items, total };
}

export async function listStatesForDropdown(): Promise<StateDropdownItem[]> {
  return prisma.state.findMany({
    select: { stateId: true, stateName: true },
    orderBy: { stateName: 'asc' },
  });
}

export async function findStateById(stateId: string): Promise<State | null> {
  return prisma.state.findUnique({ where: { stateId } });
}

export async function findStateByName(stateName: string, excludeStateId?: string): Promise<State | null> {
  return prisma.state.findFirst({
    where: {
      stateName,
      ...(excludeStateId && { stateId: { not: excludeStateId } }),
    },
  });
}

export async function updateState(stateId: string, data: UpdateStateData): Promise<State> {
  return prisma.state.update({ where: { stateId }, data });
}

export async function deleteState(stateId: string): Promise<State> {
  return prisma.state.delete({ where: { stateId } });
}

