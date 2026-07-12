import { StatusCodes } from 'http-status-codes';
import type { Agent } from '@prisma/client';
import * as agentRepository from '../repositories/agent.repository';
import { AppError } from '../utils/app-error';
import { parsePagination, buildPaginationMeta } from '../utils/pagination';
import type { PaginationQuery, PaginatedResult } from '../types';

/**
 * Input for creating a new agent. firmName, agentName, and displayName are required;
 * contact fields are optional. emailId, mobileNo, and whatsappNo must be unique when provided.
 */
export interface CreateAgentInput {
  firmName: string;
  agentName: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  mobileNo?: string | null;
  emailId?: string | null;
  displayName: string;
  whatsappNo?: string | null;
  isSubscribe?: boolean;
}

/**
 * Input for updating an agent. firmName, agentName, and displayName are required;
 * contact fields are optional. emailId, mobileNo, and whatsappNo must be unique (excluding current agent) when provided.
 */
export interface UpdateAgentInput {
  firmName: string;
  agentName: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  mobileNo?: string | null;
  emailId?: string | null;
  displayName: string;
  whatsappNo?: string | null;
  isSubscribe: boolean;
}

/** Returns true when an optional contact value is present (non-null, non-empty). */
function isProvided(value?: string | null): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Creates a new agent. When provided, throws if emailId, mobileNo, or whatsappNo already exists.
 */
export async function createAgent(input: CreateAgentInput): Promise<Agent> {
  if (isProvided(input.emailId)) {
    const existingByEmail = await agentRepository.findAgentByEmailId(input.emailId);
    if (existingByEmail) {
      throw new AppError('Email already registered for another agent', StatusCodes.CONFLICT, 4094);
    }
  }
  if (isProvided(input.mobileNo)) {
    const existingByMobile = await agentRepository.findAgentByMobileNo(input.mobileNo);
    if (existingByMobile) {
      throw new AppError('Mobile number already registered for another agent', StatusCodes.CONFLICT, 4096);
    }
  }
  if (isProvided(input.whatsappNo)) {
    const existingByWhatsapp = await agentRepository.findAgentByWhatsappNo(input.whatsappNo);
    if (existingByWhatsapp) {
      throw new AppError('WhatsApp number already registered for another agent', StatusCodes.CONFLICT, 4095);
    }
  }
  return agentRepository.createAgent({
    ...input,
    isSubscribe: input.isSubscribe ?? false,
  });
}

/**
 * Returns a paginated list of agents.
 */
export async function listAgents(query: PaginationQuery): Promise<PaginatedResult<Agent>> {
  const { skip, take } = parsePagination(query);
  const { items, total } = await agentRepository.listAgents(skip, take);
  const meta = buildPaginationMeta(total, query);
  return { data: items, meta };
}

/**
 * Retrieves a single agent by ID, or throws if not found.
 */
export async function getAgentById(agentId: string): Promise<Agent> {
  const agent = await agentRepository.findAgentById(agentId);
  if (!agent) {
    throw new AppError('Agent not found', StatusCodes.NOT_FOUND, 4044);
  }
  return agent;
}

/**
 * Updates an existing agent. When provided, throws if another agent has the same emailId, mobileNo, or whatsappNo.
 */
export async function updateAgent(agentId: string, input: UpdateAgentInput): Promise<Agent> {
  await getAgentById(agentId);
  if (isProvided(input.emailId)) {
    const existingByEmail = await agentRepository.findAgentByEmailId(input.emailId, agentId);
    if (existingByEmail) {
      throw new AppError('Email already registered for another agent', StatusCodes.CONFLICT, 4094);
    }
  }
  if (isProvided(input.mobileNo)) {
    const existingByMobile = await agentRepository.findAgentByMobileNo(input.mobileNo, agentId);
    if (existingByMobile) {
      throw new AppError('Mobile number already registered for another agent', StatusCodes.CONFLICT, 4096);
    }
  }
  if (isProvided(input.whatsappNo)) {
    const existingByWhatsapp = await agentRepository.findAgentByWhatsappNo(input.whatsappNo, agentId);
    if (existingByWhatsapp) {
      throw new AppError('WhatsApp number already registered for another agent', StatusCodes.CONFLICT, 4095);
    }
  }
  return agentRepository.updateAgent(agentId, input);
}

/**
 * Deletes an agent by ID.
 */
export async function deleteAgent(agentId: string): Promise<void> {
  await getAgentById(agentId);
  await agentRepository.deleteAgent(agentId);
}
