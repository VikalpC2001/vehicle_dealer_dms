import crypto from 'crypto';
import { StatusCodes } from 'http-status-codes';
import { AgentInvitationStatus } from '@prisma/client';
import type { AgentInvitation } from '@prisma/client';
import { config } from '../config';
import { Role } from '../types';
import * as agentInvitationRepository from '../repositories/agent-invitation.repository';
import { findAgentByEmailId, findAgentByMobileNo } from '../repositories/agent.repository';
import { findDealerById } from '../repositories/dealer.repository';
import { findUserByEmail } from '../repositories/user.repository';
import { assertCapHasFreeSlot, DEFAULT_MAX_AGENTS } from './dealer-agent.service';
import { getPrimaryAgentIdForUser } from './agent-wise-user.service';
import { hashPassword } from './password-auth.service';
import { issueUserAccessToken } from './access-token.service';
import { sendTransactionalEmail } from './email.service';
import { signRefreshToken } from '../utils/jwt';
import { AppError } from '../utils/app-error';
import type { AcceptInvitationBody } from '../validations/agent-invitation.validation';

/** How long an invitation link stays valid. */
const INVITATION_TTL_DAYS = 7;

/** The invitation row as returned to the dealer (never exposes the token hash). */
export type SafeAgentInvitation = Omit<AgentInvitation, 'tokenHash'>;

/** Strips the token hash before returning an invitation to a client. */
function toSafeInvitation(row: AgentInvitation): SafeAgentInvitation {
  const { tokenHash, ...safe } = row;
  void tokenHash;
  return safe;
}

/** Generates a random single-use link token (returned once) and its stored HMAC-SHA256 hash. */
function generateInvitationToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, tokenHash: hashInvitationToken(token) };
}

/** HMAC-SHA256(token) → hex; mirrors the EmailOtp hashing pattern (never store the raw token). */
function hashInvitationToken(token: string): string {
  return crypto.createHmac('sha256', config.JWT_SECRET).update(token).digest('hex');
}

/** Builds the public onboarding link for an invitation token. */
function buildInviteLink(token: string): string {
  return `${config.FRONTEND_URL}/agent-onboarding/${token}`;
}

/** Sends the onboarding email (logged to stdout in dev when SMTP is unconfigured). */
async function sendInviteEmail(params: {
  to: string;
  agentName: string;
  dealerName: string;
  link: string;
}): Promise<void> {
  const { to, agentName, dealerName, link } = params;
  const subject = `${dealerName} invited you to join as an RTO agent`;
  const text =
    `Hi ${agentName},\n\n${dealerName} has invited you to join their RTO platform as an agent.\n\n` +
    `Complete your onboarding here (link valid ${INVITATION_TTL_DAYS} days):\n${link}\n\n` +
    `If you weren't expecting this, you can ignore this email.`;
  await sendTransactionalEmail({ to, subject, text });
}

/**
 * Creates a dealer→agent invitation: enforces the dealer's agent cap, rejects an email/mobile that
 * already belongs to an agent (steer the dealer to search/grant instead), stores a hashed
 * single-use token, and emails the onboarding link. In non-production the link is echoed back
 * (`inviteLink`) to ease testing.
 *
 * @throws AppError 422 (4231) when the dealer is at their agent cap.
 * @throws AppError 409 (4112) when the email/mobile is already a registered agent.
 */
export async function createInvitation(
  dealerId: string,
  createdByUserId: string | null,
  body: { agentName: string; emailId: string; mobileNo?: string },
): Promise<SafeAgentInvitation & { inviteLink?: string }> {
  await assertCapHasFreeSlot(dealerId);

  const email = body.emailId.trim().toLowerCase();

  // A user with this email already exists (email is globally unique, so onboarding would fail).
  // If they're an agent, steer the dealer to search + grant (4112); otherwise it's a hard conflict.
  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    const linkedAgentId = await getPrimaryAgentIdForUser(existingUser.userId);
    if (linkedAgentId) {
      throw new AppError(
        'This person is already an agent — search for them and grant access instead',
        StatusCodes.CONFLICT,
        4112,
      );
    }
    throw new AppError(
      'An account with this email already exists',
      StatusCodes.CONFLICT,
      4091,
    );
  }

  const existingByEmail = await findAgentByEmailId(email);
  if (existingByEmail) {
    throw new AppError(
      'An agent with this email already exists — search for them and grant access instead',
      StatusCodes.CONFLICT,
      4112,
    );
  }
  if (body.mobileNo) {
    const existingByMobile = await findAgentByMobileNo(body.mobileNo.trim());
    if (existingByMobile) {
      throw new AppError(
        'An agent with this mobile number already exists — search for them and grant access instead',
        StatusCodes.CONFLICT,
        4112,
      );
    }
  }

  const dealer = await findDealerById(dealerId);
  if (!dealer) {
    throw new AppError('Dealer not found', StatusCodes.NOT_FOUND, 4043);
  }

  const { token, tokenHash } = generateInvitationToken();
  const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const row = await agentInvitationRepository.createInvitation({
    dealerId,
    agentName: body.agentName.trim(),
    emailId: email,
    mobileNo: body.mobileNo?.trim() ?? null,
    tokenHash,
    expiresAt,
    createdByUserId,
  });

  const link = buildInviteLink(token);
  await sendInviteEmail({
    to: email,
    agentName: row.agentName,
    dealerName: dealer.displayName || dealer.firmName,
    link,
  });

  const safe = toSafeInvitation(row);
  return config.NODE_ENV === 'production' ? safe : { ...safe, inviteLink: link };
}

/**
 * Lists the dealer's pending invitations.
 */
export async function listInvitations(dealerId: string): Promise<SafeAgentInvitation[]> {
  const rows = await agentInvitationRepository.listPendingByDealer(dealerId);
  return rows.map(toSafeInvitation);
}

/** Loads an invitation and asserts it belongs to the dealer and is still PENDING. */
async function loadOwnedPendingInvitation(
  dealerId: string,
  invitationId: string,
): Promise<AgentInvitation> {
  const row = await agentInvitationRepository.findInvitationById(invitationId);
  if (!row) {
    throw new AppError('Invitation not found', StatusCodes.NOT_FOUND, 4061);
  }
  if (row.dealerId !== dealerId) {
    throw new AppError('You do not have access to this resource', StatusCodes.FORBIDDEN, 4034);
  }
  if (row.status !== AgentInvitationStatus.PENDING) {
    throw new AppError(
      'This invitation is no longer pending',
      StatusCodes.CONFLICT,
      4110,
    );
  }
  return row;
}

/**
 * Regenerates the token + expiry of a pending invitation and re-sends the email.
 */
export async function resendInvitation(
  dealerId: string,
  invitationId: string,
): Promise<SafeAgentInvitation & { inviteLink?: string }> {
  const row = await loadOwnedPendingInvitation(dealerId, invitationId);
  const dealer = await findDealerById(dealerId);
  if (!dealer) {
    throw new AppError('Dealer not found', StatusCodes.NOT_FOUND, 4043);
  }

  const { token, tokenHash } = generateInvitationToken();
  const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const updated = await agentInvitationRepository.updateInvitation(row.invitationId, {
    tokenHash,
    expiresAt,
  });

  const link = buildInviteLink(token);
  await sendInviteEmail({
    to: updated.emailId,
    agentName: updated.agentName,
    dealerName: dealer.displayName || dealer.firmName,
    link,
  });

  const safe = toSafeInvitation(updated);
  return config.NODE_ENV === 'production' ? safe : { ...safe, inviteLink: link };
}

/**
 * Cancels a pending invitation (soft — the row is retained with status CANCELLED).
 */
export async function cancelInvitation(
  dealerId: string,
  invitationId: string,
): Promise<SafeAgentInvitation> {
  const row = await loadOwnedPendingInvitation(dealerId, invitationId);
  const updated = await agentInvitationRepository.updateInvitation(row.invitationId, {
    status: AgentInvitationStatus.CANCELLED,
  });
  return toSafeInvitation(updated);
}

/** Prefill returned by the public GET accept route. */
export interface InvitationPrefill {
  agentName: string;
  emailId: string;
  mobileNo: string | null;
  dealerName: string;
}

/**
 * Validates a public invitation token and returns the onboarding prefill. Auto-marks an
 * expired-but-still-pending invitation as EXPIRED.
 *
 * @throws AppError 404 (4061) unknown token · 409 (4110) already used/cancelled · 409 (4111) expired.
 */
export async function getInvitationPrefill(token: string): Promise<InvitationPrefill> {
  const row = await resolveValidInvitation(token);
  return {
    agentName: row.agentName,
    emailId: row.emailId,
    mobileNo: row.mobileNo,
    dealerName: row.dealer.displayName || row.dealer.firmName,
  };
}

/** Looks up a token, validates status/expiry, and returns the row (with dealer display fields). */
async function resolveValidInvitation(
  token: string,
): Promise<AgentInvitation & { dealer: { firmName: string; displayName: string } }> {
  const tokenHash = hashInvitationToken(token);
  const row = await agentInvitationRepository.findInvitationByTokenHash(tokenHash);
  if (!row) {
    throw new AppError('Invitation not found', StatusCodes.NOT_FOUND, 4061);
  }
  if (row.status !== AgentInvitationStatus.PENDING) {
    throw new AppError(
      'This invitation has already been used or was cancelled',
      StatusCodes.CONFLICT,
      4110,
    );
  }
  if (row.expiresAt.getTime() <= Date.now()) {
    await agentInvitationRepository.updateInvitation(row.invitationId, {
      status: AgentInvitationStatus.EXPIRED,
    });
    throw new AppError('This invitation has expired', StatusCodes.CONFLICT, 4111);
  }
  return row;
}

/** Result of accepting an invitation: a login bundle plus whether the dealer grant was applied. */
export interface AcceptInvitationResult {
  token: string;
  refreshToken: string;
  granted: boolean;
  user: {
    userId: string;
    emailId: string;
    userName: string;
    emailVerified: boolean;
    dealerId: null;
    agentId: string;
    isSuperAdmin: false;
  };
}

/**
 * Accepts an invitation: creates the agent account + verified login and (cap permitting) grants it
 * to the inviting dealer, then logs the new agent straight in. The DB mutations are atomic (one
 * transaction in the repository); the password is hashed before the transaction. The dealer's
 * current cap is read here and passed in — at cap, the account is still created but not granted
 * (`granted: false`), and the dealer can activate it later from a free slot.
 */
export async function acceptInvitation(
  token: string,
  body: AcceptInvitationBody,
): Promise<AcceptInvitationResult> {
  const invitation = await resolveValidInvitation(token);
  const dealer = await findDealerById(invitation.dealerId);
  const maxAgents = dealer?.maxAgents ?? DEFAULT_MAX_AGENTS;

  const hashedPassword = await hashPassword(body.password);
  const result = await agentInvitationRepository.acceptInvitationTx({
    invitationId: invitation.invitationId,
    dealerId: invitation.dealerId,
    maxAgents,
    userName: body.agentName.trim(),
    hashedPassword,
    agent: {
      firmName: body.firmName.trim(),
      agentName: body.agentName.trim(),
      displayName: body.displayName.trim(),
      mobileNo: body.mobileNo.trim(),
      emailId: invitation.emailId,
      address: body.address?.trim() ?? null,
      city: body.city?.trim() ?? null,
      state: body.state?.trim() ?? null,
      pincode: body.pincode?.trim() ?? null,
      whatsappNo: body.whatsappNo?.trim() ?? null,
    },
  });

  const accessToken = await issueUserAccessToken({
    userId: result.user.userId,
    email: result.user.emailId,
    role: Role.USER,
  });
  const refreshToken = signRefreshToken(result.user.userId);

  return {
    token: accessToken,
    refreshToken,
    granted: result.granted,
    user: {
      userId: result.user.userId,
      emailId: result.user.emailId,
      userName: result.user.userName,
      emailVerified: result.user.emailVerified,
      dealerId: null,
      agentId: result.agentId,
      isSuperAdmin: false,
    },
  };
}
