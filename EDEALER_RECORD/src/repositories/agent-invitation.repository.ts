import { StatusCodes } from 'http-status-codes';
import {
  AgentInvitationStatus,
  DealerAgentSource,
  DealerAgentStatus,
} from '@prisma/client';
import type { AgentInvitation, User } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/app-error';

/** Data to create a pending invitation row (token already hashed by the caller). */
export interface CreateAgentInvitationData {
  dealerId: string;
  agentName: string;
  emailId: string;
  mobileNo?: string | null;
  tokenHash: string;
  expiresAt: Date;
  createdByUserId?: string | null;
}

/** Default kanban statuses seeded for a new agent (mirrors agent.repository). */
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
 * Creates a pending invitation row.
 */
export async function createInvitation(
  data: CreateAgentInvitationData,
): Promise<AgentInvitation> {
  return prisma.agentInvitation.create({
    data: {
      dealerId: data.dealerId,
      agentName: data.agentName,
      emailId: data.emailId,
      mobileNo: data.mobileNo ?? null,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
      createdByUserId: data.createdByUserId ?? null,
      status: AgentInvitationStatus.PENDING,
    },
  });
}

/**
 * Finds an invitation by its primary key. Returns null when absent.
 */
export async function findInvitationById(
  invitationId: string,
): Promise<AgentInvitation | null> {
  return prisma.agentInvitation.findUnique({ where: { invitationId } });
}

/**
 * Finds an invitation by its hashed token, joined with the inviting dealer's display fields.
 * Used by the public accept/prefill routes.
 */
export async function findInvitationByTokenHash(
  tokenHash: string,
): Promise<(AgentInvitation & { dealer: { firmName: string; displayName: string } }) | null> {
  return prisma.agentInvitation.findUnique({
    where: { tokenHash },
    include: { dealer: { select: { firmName: true, displayName: true } } },
  });
}

/**
 * Lists a dealer's PENDING invitations, newest first.
 */
export async function listPendingByDealer(dealerId: string): Promise<AgentInvitation[]> {
  return prisma.agentInvitation.findMany({
    where: { dealerId, status: AgentInvitationStatus.PENDING },
    orderBy: { createdAt: 'desc' },
  });
}

/** Fields updatable on an invitation (status transitions, token refresh on resend). */
export interface UpdateAgentInvitationData {
  status?: AgentInvitationStatus;
  tokenHash?: string;
  expiresAt?: Date;
  acceptedAt?: Date | null;
}

/**
 * Updates an invitation row (status / token / expiry).
 */
export async function updateInvitation(
  invitationId: string,
  data: UpdateAgentInvitationData,
): Promise<AgentInvitation> {
  return prisma.agentInvitation.update({ where: { invitationId }, data });
}

/** Profile for the agent created on acceptance. */
export interface AcceptAgentProfile {
  firmName: string;
  agentName: string;
  displayName: string;
  mobileNo: string;
  emailId: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  whatsappNo?: string | null;
}

/** Result of accepting an invitation. */
export interface AcceptInvitationResult {
  agentId: string;
  user: Pick<User, 'userId' | 'emailId' | 'userName' | 'emailVerified'>;
  granted: boolean;
}

/**
 * Atomically accepts an invitation: creates the agent (+ seeded statuses), a verified user, and
 * the agent↔user link; grants the agent to the inviting dealer when a cap slot is free (else the
 * account is still created, just ungranted); and marks the invitation ACCEPTED. Everything runs in
 * ONE transaction — the existing per-helper transactions are inlined here (never nested) so a
 * failure rolls the whole thing back.
 *
 * @param params.invitationId - The invitation being consumed (re-validated PENDING inside the tx).
 * @param params.dealerId - The inviting dealer (grant target + cap owner).
 * @param params.maxAgents - The dealer's active-agent cap at accept time.
 * @param params.agent - The agent profile from the onboarding form.
 * @param params.userName - Display name for the login user.
 * @param params.hashedPassword - Pre-hashed password (bcrypt), hashed before the tx.
 * @throws AppError 4110 when the invitation is no longer PENDING (already consumed/cancelled).
 * @throws AppError 4091 when a user with that email already exists.
 */
export async function acceptInvitationTx(params: {
  invitationId: string;
  dealerId: string;
  maxAgents: number;
  agent: AcceptAgentProfile;
  userName: string;
  hashedPassword: string;
}): Promise<AcceptInvitationResult> {
  const { invitationId, dealerId, maxAgents, agent, userName, hashedPassword } = params;
  return prisma.$transaction(async (tx) => {
    const invitation = await tx.agentInvitation.findUnique({ where: { invitationId } });
    if (!invitation || invitation.status !== AgentInvitationStatus.PENDING) {
      throw new AppError(
        'This invitation has already been used or is no longer valid',
        StatusCodes.CONFLICT,
        4110,
      );
    }

    const existingUser = await tx.user.findUnique({ where: { emailId: agent.emailId } });
    if (existingUser) {
      throw new AppError('An account with this email already exists', StatusCodes.CONFLICT, 4091);
    }

    const used = await tx.dealerAgent.count({
      where: {
        dealerId,
        status: DealerAgentStatus.ACTIVE,
        source: DealerAgentSource.DEALER_GRANT,
      },
    });
    const granted = used < maxAgents;

    const createdAgent = await tx.agent.create({
      data: {
        firmName: agent.firmName,
        agentName: agent.agentName,
        displayName: agent.displayName,
        mobileNo: agent.mobileNo,
        emailId: agent.emailId,
        address: agent.address ?? null,
        city: agent.city ?? null,
        state: agent.state ?? null,
        pincode: agent.pincode ?? null,
        whatsappNo: agent.whatsappNo ?? null,
      },
    });
    await tx.agentStatus.createMany({
      data: DEFAULT_AGENT_STATUSES.map((s) => ({
        agentId: createdAgent.agentId,
        statusName: s.statusName,
        colour: s.colour,
        statusRank: s.statusRank,
      })),
    });

    const user = await tx.user.create({
      data: {
        emailId: agent.emailId,
        password: hashedPassword,
        userName,
        mobileNo: agent.mobileNo,
        gender: null,
        emailVerified: true,
      },
    });
    await tx.agentWiseUser.create({
      data: { agentId: createdAgent.agentId, userId: user.userId },
    });

    if (granted) {
      await tx.dealerAgent.upsert({
        where: { dealerId_agentId: { dealerId, agentId: createdAgent.agentId } },
        create: {
          dealerId,
          agentId: createdAgent.agentId,
          status: DealerAgentStatus.ACTIVE,
          source: DealerAgentSource.DEALER_GRANT,
        },
        update: {
          status: DealerAgentStatus.ACTIVE,
          source: DealerAgentSource.DEALER_GRANT,
        },
      });
    }

    await tx.agentInvitation.update({
      where: { invitationId },
      data: { status: AgentInvitationStatus.ACCEPTED, acceptedAt: new Date() },
    });

    return {
      agentId: createdAgent.agentId,
      user: {
        userId: user.userId,
        emailId: user.emailId,
        userName: user.userName,
        emailVerified: user.emailVerified,
      },
      granted,
    };
  });
}
