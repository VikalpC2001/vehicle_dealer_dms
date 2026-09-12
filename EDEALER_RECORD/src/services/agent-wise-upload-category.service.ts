import { StatusCodes } from 'http-status-codes';
import { findAgentById } from '../repositories/agent.repository';
import * as agentWiseUploadCategoryRepository from '../repositories/agent-wise-upload-category.repository';
import type {
  AgentWiseUploadCategoryWithCategory,
  UpdateAgentWiseOrderRankItem,
} from '../repositories/agent-wise-upload-category.repository';
import { AppError } from '../utils/app-error';
import { getUploadCategoryById } from './upload-category.service';

export interface CreateAgentWiseUploadCategoryInput {
  agentId: string;
  uploadCategoryId: string;
  processApi?: string | null;
  isRequired: boolean;
  isProcess: boolean;
  isViewInStep: boolean;
}

export interface UpdateAgentWiseUploadCategoryInput {
  uploadCategoryId: string;
  processApi?: string | null;
  isRequired: boolean;
  isProcess: boolean;
  isViewInStep: boolean;
}

export interface UpdateAgentWiseUploadOrderRanksInput {
  agentId: string;
  items: UpdateAgentWiseOrderRankItem[];
}

/**
 * API shape for an agent-wise link: `awucId`, `agentId`, and a nested `uploadCategory`
 * that merges global name/id with per-agent rank, flags, and `processApi`.
 */
export interface AgentWiseUploadCategoryResponseDto {
  awucId: string;
  agentId: string;
  uploadCategory: {
    categoryId: string;
    categoryName: string;
    orderRank: number;
    isRequired: boolean;
    processApi: string | null;
    isProcess: boolean;
    isViewInStep: boolean;
  };
}

/**
 * One entry inside `uploadCategory` for list/order responses (`GET ?agentId=` and `PUT .../order`).
 */
export interface AgentWiseUploadCategoryListEntryDto {
  awucId: string;
  categoryId: string;
  categoryName: string;
  orderRank: number;
  isRequired: boolean;
  processApi: string | null;
  isProcess: boolean;
  isViewInStep: boolean;
}

/** List entry for view-in-step, including master `bothSide` from `UploadCategory`. */
export interface AgentWiseUploadCategoryViewInStepEntryDto
  extends AgentWiseUploadCategoryListEntryDto {
  bothSide: boolean;
}

/**
 * `data` shape for listing (and reorder) — single `agentId` and an array of per-link category rows.
 */
export interface AgentWiseUploadCategoriesByAgentDto {
  agentId: string;
  uploadCategory: AgentWiseUploadCategoryListEntryDto[];
}

/** `data` shape for GET view-in-step. */
export interface AgentWiseUploadCategoriesViewInStepDto {
  agentId: string;
  uploadCategory: AgentWiseUploadCategoryViewInStepEntryDto[];
}

const toAgentWiseUploadCategoryDto = (
  row: AgentWiseUploadCategoryWithCategory,
): AgentWiseUploadCategoryResponseDto => ({
  awucId: row.awucId,
  agentId: row.agentId,
  uploadCategory: {
    categoryId: row.uploadCategory.categoryId,
    categoryName: row.uploadCategory.categoryName,
    orderRank: row.orderRank,
    isRequired: row.isRequired,
    processApi: row.uploadCategory.processApi ?? row.processApi,
    isProcess: row.isProcess,
    isViewInStep: row.isViewInStep,
  },
});

const toAgentWiseUploadCategoryListEntry = (
  row: AgentWiseUploadCategoryWithCategory,
): AgentWiseUploadCategoryListEntryDto => ({
  awucId: row.awucId,
  categoryId: row.uploadCategory.categoryId,
  categoryName: row.uploadCategory.categoryName,
  orderRank: row.orderRank,
  isRequired: row.isRequired,
  processApi: row.uploadCategory.processApi ?? row.processApi,
  isProcess: row.isProcess,
  isViewInStep: row.isViewInStep,
});

const toAgentWiseUploadCategoriesByAgent = (
  agentId: string,
  rows: AgentWiseUploadCategoryWithCategory[],
): AgentWiseUploadCategoriesByAgentDto => ({
  agentId,
  uploadCategory: rows.map(toAgentWiseUploadCategoryListEntry),
});

const toAgentWiseUploadCategoryViewInStepEntry = (
  row: AgentWiseUploadCategoryWithCategory,
): AgentWiseUploadCategoryViewInStepEntryDto => ({
  ...toAgentWiseUploadCategoryListEntry(row),
  bothSide: row.uploadCategory.bothSide,
});

const toAgentWiseUploadCategoriesViewInStep = (
  agentId: string,
  rows: AgentWiseUploadCategoryWithCategory[],
): AgentWiseUploadCategoriesViewInStepDto => ({
  agentId,
  uploadCategory: rows.map(toAgentWiseUploadCategoryViewInStepEntry),
});

const normalizeProcessApi = (value: string | null | undefined): string | null => {
  if (value === undefined || value === null) {
    return null;
  }
  const t = value.trim();
  return t.length === 0 ? null : t;
};

/** Ensures the agent exists. */
const assertAgentExists = async (agentId: string): Promise<void> => {
  const agent = await findAgentById(agentId);
  if (!agent) {
    throw new AppError('Agent not found', StatusCodes.NOT_FOUND, 4044);
  }
};

/** Loads an agent-wise row or throws 404. */
export async function getAgentWiseUploadCategoryById(
  awucId: string,
): Promise<AgentWiseUploadCategoryResponseDto> {
  const row = await agentWiseUploadCategoryRepository.findAgentWiseUploadCategoryById(awucId);
  if (!row) {
    throw new AppError('Agent upload category link not found', StatusCodes.NOT_FOUND, 4052);
  }
  return toAgentWiseUploadCategoryDto(row);
}

/** Creates a link; `uploadCategoryId` must be unique per `agentId`. */
export async function createAgentWiseUploadCategory(
  input: CreateAgentWiseUploadCategoryInput,
): Promise<AgentWiseUploadCategoryResponseDto> {
  await assertAgentExists(input.agentId);
  await getUploadCategoryById(input.uploadCategoryId);
  const existing = await agentWiseUploadCategoryRepository.findAgentWiseUploadByAgentAndCategory(
    input.agentId,
    input.uploadCategoryId,
  );
  if (existing) {
    throw new AppError(
      'This upload category is already assigned to this agent',
      StatusCodes.CONFLICT,
      4098,
    );
  }
  const created = await agentWiseUploadCategoryRepository.createAgentWiseUploadCategory({
    agentId: input.agentId,
    uploadCategoryId: input.uploadCategoryId,
    processApi: normalizeProcessApi(input.processApi),
    isRequired: input.isRequired,
    isProcess: input.isProcess,
    isViewInStep: input.isViewInStep,
  });
  return toAgentWiseUploadCategoryDto(created);
}

/** Lists all links for an agent (no pagination), ordered by `orderRank`. */
export async function listAgentWiseUploadCategories(
  agentId: string,
): Promise<AgentWiseUploadCategoriesByAgentDto> {
  await assertAgentExists(agentId);
  const rows =
    await agentWiseUploadCategoryRepository.listAgentWiseUploadCategoriesByAgentId(agentId);
  return toAgentWiseUploadCategoriesByAgent(agentId, rows);
}

/**
 * Lists links for an agent with `isViewInStep === true` only, ordered by `orderRank`.
 * Each entry includes master `bothSide` from `UploadCategory`.
 */
export async function listAgentWiseUploadCategoriesViewInStep(
  agentId: string,
): Promise<AgentWiseUploadCategoriesViewInStepDto> {
  await assertAgentExists(agentId);
  const rows =
    await agentWiseUploadCategoryRepository.listAgentWiseUploadCategoriesByAgentIdViewInStep(agentId);
  return toAgentWiseUploadCategoriesViewInStep(agentId, rows);
}

/** Updates a link; changing `uploadCategoryId` must stay unique per agent. */
export async function updateAgentWiseUploadCategory(
  awucId: string,
  input: UpdateAgentWiseUploadCategoryInput,
): Promise<AgentWiseUploadCategoryResponseDto> {
  const current = await agentWiseUploadCategoryRepository.findAgentWiseUploadCategoryById(awucId);
  if (!current) {
    throw new AppError('Agent upload category link not found', StatusCodes.NOT_FOUND, 4052);
  }
  await getUploadCategoryById(input.uploadCategoryId);
  const conflict = await agentWiseUploadCategoryRepository.findAgentWiseUploadByAgentAndCategory(
    current.agentId,
    input.uploadCategoryId,
    awucId,
  );
  if (conflict) {
    throw new AppError(
      'This upload category is already assigned to this agent',
      StatusCodes.CONFLICT,
      4098,
    );
  }
  const updated = await agentWiseUploadCategoryRepository.updateAgentWiseUploadCategory(awucId, {
    uploadCategoryId: input.uploadCategoryId,
    processApi: normalizeProcessApi(input.processApi),
    isRequired: input.isRequired,
    isProcess: input.isProcess,
    isViewInStep: input.isViewInStep,
  });
  return toAgentWiseUploadCategoryDto(updated);
}

/** Deletes a link by `awucId`. */
export async function deleteAgentWiseUploadCategory(awucId: string): Promise<void> {
  const row = await agentWiseUploadCategoryRepository.findAgentWiseUploadCategoryById(awucId);
  if (!row) {
    throw new AppError('Agent upload category link not found', StatusCodes.NOT_FOUND, 4052);
  }
  await agentWiseUploadCategoryRepository.deleteAgentWiseUploadCategory(awucId);
}

/**
 * Bulk-updates `orderRank` for an agent's links. Every `awucId` must belong to `agentId`.
 * Returns the full list for that agent ordered by `orderRank`.
 */
export async function updateAgentWiseUploadOrderRanks(
  input: UpdateAgentWiseUploadOrderRanksInput,
): Promise<AgentWiseUploadCategoriesByAgentDto> {
  await assertAgentExists(input.agentId);
  const current =
    await agentWiseUploadCategoryRepository.listAgentWiseUploadCategoriesByAgentId(input.agentId);
  const currentIds = new Set(current.map((r) => r.awucId));
  for (const item of input.items) {
    if (!currentIds.has(item.awucId)) {
      throw new AppError(
        'One or more upload category links do not belong to this agent',
        StatusCodes.UNPROCESSABLE_ENTITY,
        4225,
      );
    }
  }
  await agentWiseUploadCategoryRepository.updateAgentWiseUploadOrderRanks(input.items);
  const rows =
    await agentWiseUploadCategoryRepository.listAgentWiseUploadCategoriesByAgentId(input.agentId);
  return toAgentWiseUploadCategoriesByAgent(input.agentId, rows);
}
