import { StatusCodes } from 'http-status-codes';
import type { DealerTaskTemplate } from '@prisma/client';
import * as dealerTaskTemplateRepository from '../repositories/dealer-task-template.repository';
import { AppError } from '../utils/app-error';
import { parsePagination, buildPaginationMeta } from '../utils/pagination';
import type { PaginationQuery, PaginatedResult } from '../types';

/**
 * Input for creating a new dealer task template.
 * templateName is required and must be unique per dealer.
 */
export interface CreateDealerTaskTemplateInput {
  dealerId: string;
  templateName: string;
}

/**
 * Input for updating a dealer task template.
 * templateName is required and must be unique per dealer (excluding current template).
 */
export interface UpdateDealerTaskTemplateInput {
  templateName: string;
}

/**
 * Creates a new dealer task template.
 * Throws if templateName already exists for the same dealer.
 */
export async function createDealerTaskTemplate(
  input: CreateDealerTaskTemplateInput,
): Promise<DealerTaskTemplate> {
  const existingByName =
    await dealerTaskTemplateRepository.findDealerTaskTemplateByDealerAndName(
      input.dealerId,
      input.templateName,
    );
  if (existingByName) {
    throw new AppError(
      'Template name already exists for this dealer',
      StatusCodes.CONFLICT,
      4090,
    );
  }

  return dealerTaskTemplateRepository.createDealerTaskTemplate(input);
}

/**
 * Returns a paginated list of dealer task templates for a specific dealer, ordered by templateName ascending.
 */
export async function listDealerTaskTemplates(
  query: PaginationQuery & { dealerId: string },
): Promise<PaginatedResult<DealerTaskTemplate>> {
  const { skip, take } = parsePagination(query);
  const { items, total } =
    await dealerTaskTemplateRepository.listDealerTaskTemplates(
      skip,
      take,
      query.dealerId,
    );
  const meta = buildPaginationMeta(total, query);
  return { data: items, meta };
}

/**
 * Retrieves a single dealer task template by ID, or throws if not found.
 */
export async function getDealerTaskTemplateById(
  templateId: string,
): Promise<DealerTaskTemplate> {
  const template =
    await dealerTaskTemplateRepository.findDealerTaskTemplateById(templateId);
  if (!template) {
    throw new AppError(
      'Dealer task template not found',
      StatusCodes.NOT_FOUND,
      4066,
    );
  }
  return template;
}

/**
 * Updates an existing dealer task template.
 * Throws if another template for the same dealer has the same templateName.
 */
export async function updateDealerTaskTemplate(
  templateId: string,
  input: UpdateDealerTaskTemplateInput,
): Promise<DealerTaskTemplate> {
  const current = await getDealerTaskTemplateById(templateId);

  const existingByName =
    await dealerTaskTemplateRepository.findDealerTaskTemplateByDealerAndName(
      current.dealerId,
      input.templateName,
      templateId,
    );
  if (existingByName) {
    throw new AppError(
      'Template name already exists for this dealer',
      StatusCodes.CONFLICT,
      4090,
    );
  }

  return dealerTaskTemplateRepository.updateDealerTaskTemplate(templateId, input);
}

/**
 * Deletes a dealer task template by ID.
 */
export async function deleteDealerTaskTemplate(
  templateId: string,
): Promise<void> {
  await getDealerTaskTemplateById(templateId);
  await dealerTaskTemplateRepository.deleteDealerTaskTemplate(templateId);
}
