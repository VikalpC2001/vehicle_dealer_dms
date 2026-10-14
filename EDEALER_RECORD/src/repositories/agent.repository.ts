import { prisma } from '../config/prisma';
import type { Agent, ApprovalStatus } from '@prisma/client';

/**
 * Data required to create a new agent. firmName, agentName, and displayName are required;
 * contact fields are optional. emailId, mobileNo, and whatsappNo must be unique when provided.
 */
export interface CreateAgentData {
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
  approvalStatus?: ApprovalStatus;
}

/**
 * Data allowed when updating an agent. firmName, agentName, and displayName are required;
 * contact fields are optional. emailId, mobileNo, and whatsappNo must be unique (excluding current agent) when provided.
 */
export interface UpdateAgentData {
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

/** Default statuses created for each new agent. */
const DEFAULT_AGENT_STATUSES: ReadonlyArray<{
  statusName: string;
  colour: string;
  statusRank: number;
}> = [
  { statusName: 'To-Do', colour: 'blue', statusRank: 1 },
  { statusName: 'In Progress', colour: 'yellow', statusRank: 2 },
  { statusName: 'Inward', colour: 'purple', statusRank: 3 },
  { statusName: 'Pending', colour: 'orange', statusRank: 4 },
  { statusName: 'Query', colour: 'red', statusRank: 5 },
  { statusName: 'Complete', colour: 'green', statusRank: 6 },
];

/**
 * Creates a new agent and its six default statuses (To-Do, In Progress, Inward, Pending, Query, Complete).
 */
export async function createAgent(data: CreateAgentData): Promise<Agent> {
  return prisma.$transaction(async (tx) => {
    const agent = await tx.agent.create({
      data: {
        firmName: data.firmName,
        agentName: data.agentName,
        address: data.address ?? null,
        city: data.city ?? null,
        state: data.state ?? null,
        pincode: data.pincode ?? null,
        mobileNo: data.mobileNo ?? null,
        emailId: data.emailId ?? null,
        displayName: data.displayName,
        whatsappNo: data.whatsappNo ?? null,
        isSubscribe: data.isSubscribe ?? false,
        approvalStatus: data.approvalStatus,
      },
    });
    await tx.agentStatus.createMany({
      data: DEFAULT_AGENT_STATUSES.map((s) => ({
        agentId: agent.agentId,
        statusName: s.statusName,
        colour: s.colour,
        statusRank: s.statusRank,
      })),
    });
    return agent;
  });
}

/**
 * Returns a paginated list of agents and total count.
 */
export async function listAgents(
  skip: number,
  take: number,
): Promise<{ items: Agent[]; total: number }> {
  const [items, total] = await Promise.all([
    prisma.agent.findMany({
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.agent.count(),
  ]);
  return { items, total };
}

/**
 * Finds a single agent by ID.
 */
export async function findAgentById(agentId: string): Promise<Agent | null> {
  return prisma.agent.findUnique({
    where: { agentId },
  });
}

/**
 * Finds an agent by emailId. Optionally exclude an agent ID (for update uniqueness check).
 */
export async function findAgentByEmailId(
  emailId: string,
  excludeAgentId?: string,
): Promise<Agent | null> {
  return prisma.agent.findFirst({
    where: {
      emailId,
      ...(excludeAgentId && { agentId: { not: excludeAgentId } }),
    },
  });
}

/**
 * Finds an agent by mobileNo. Optionally exclude an agent ID (for update uniqueness check).
 */
export async function findAgentByMobileNo(
  mobileNo: string,
  excludeAgentId?: string,
): Promise<Agent | null> {
  return prisma.agent.findFirst({
    where: {
      mobileNo,
      ...(excludeAgentId && { agentId: { not: excludeAgentId } }),
    },
  });
}

/**
 * Finds an agent by whatsappNo. Optionally exclude an agent ID (for update uniqueness check).
 */
export async function findAgentByWhatsappNo(
  whatsappNo: string,
  excludeAgentId?: string,
): Promise<Agent | null> {
  return prisma.agent.findFirst({
    where: {
      whatsappNo,
      ...(excludeAgentId && { agentId: { not: excludeAgentId } }),
    },
  });
}

/**
 * Updates an existing agent.
 */
export async function updateAgent(
  agentId: string,
  data: UpdateAgentData,
): Promise<Agent> {
  return prisma.agent.update({
    where: { agentId },
    data,
  });
}

/** Sets an agent's subscription flag (super-admin subscription management). */
export async function setAgentSubscription(
  agentId: string,
  isSubscribe: boolean,
): Promise<Agent> {
  return prisma.agent.update({
    where: { agentId },
    data: { isSubscribe },
  });
}

/** Sets an agent's access switch (`isActive`; `false` = paused) — super-admin access management. */
export async function setAgentAccess(agentId: string, isActive: boolean): Promise<Agent> {
  return prisma.agent.update({
    where: { agentId },
    data: { isActive },
  });
}

/**
 * Lean access lookup: reads only `isActive` by primary key. Called by `authenticate` on the hot
 * path (through the firm-access cache), so it must stay a single-column read.
 *
 * @returns The flag, or `null` when the agent does not exist.
 */
export async function findAgentAccessById(
  agentId: string,
): Promise<Pick<Agent, 'isActive'> | null> {
  return prisma.agent.findUnique({
    where: { agentId },
    select: { isActive: true },
  });
}

/**
 * Sets an agent's self-registration approval state (and optional reason for a rejection).
 */
export async function setAgentApproval(
  agentId: string,
  approvalStatus: ApprovalStatus,
  approvalReason: string | null,
): Promise<Agent> {
  return prisma.agent.update({
    where: { agentId },
    data: { approvalStatus, approvalReason },
  });
}

/**
 * Lists agents whose approval is in the given states (newest first) — super-admin request queue.
 * Only agents with a **verified** linked login are returned (abandoned self-registrations are hidden).
 */
export async function listAgentsByApprovalStatuses(statuses: ApprovalStatus[]): Promise<Agent[]> {
  return prisma.agent.findMany({
    where: {
      approvalStatus: { in: statuses },
      agentWiseUsers: { some: { user: { emailVerified: true } } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Deletes an agent by ID.
 */
export async function deleteAgent(agentId: string): Promise<Agent> {
  return prisma.agent.delete({
    where: { agentId },
  });
}
