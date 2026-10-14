import { StatusCodes } from 'http-status-codes';
import type { ApprovalStatus } from '@prisma/client';
import { config } from '../config';
import * as dealerRepository from '../repositories/dealer.repository';
import * as agentRepository from '../repositories/agent.repository';
import { findUserByEmail, findUserById, deleteUser } from '../repositories/user.repository';
import { createDealer } from './dealer.service';
import { createAgent } from './agent.service';
import { createDealerWiseUserWithUser, getPrimaryDealerIdForUser } from './dealer-wise-user.service';
import { createAgentWiseUserWithUser, getPrimaryAgentIdForUser } from './agent-wise-user.service';
import { issueSignupOtp } from './otp-auth.service';
import { sendTransactionalEmail } from './email.service';
import { renderEmailHtml } from '../utils/email-template';
import { AppError } from '../utils/app-error';
import { parsePagination, buildPaginationMeta } from '../utils/pagination';
import type { PaginationQuery, PaginatedResult } from '../types';
import type { SelfRegisterBody } from '../validations/registration.validation';

/** The persona a self-registration is for. */
export type RegistrationKind = 'dealer' | 'agent';

/** A pending/rejected self-registration surfaced to the super-admin (dealer or agent, unified). */
export interface RegistrationDto {
  kind: RegistrationKind;
  id: string;
  firmName: string;
  applicantName: string;
  emailId: string | null;
  mobileNo: string | null;
  approvalStatus: ApprovalStatus;
  approvalReason: string | null;
  createdAt: Date;
}

// --- emails ---------------------------------------------------------------------------------------

async function sendApprovedEmail(to: string, kind: RegistrationKind): Promise<void> {
  const loginLink = `${config.FRONTEND_URL}/login`;
  const account = kind === 'dealer' ? 'dealer' : 'RTO agent';
  await sendTransactionalEmail({
    to,
    subject: 'Your account has been approved',
    text: `Your ${account} account is approved. Sign in: ${loginLink}`,
    html: renderEmailHtml({
      preheader: `Your ${account} account is approved.`,
      badge: { label: 'Approved', tone: 'success' },
      title: 'Your account is approved',
      message: `Your ${account} account is ready. Sign in to get started.`,
      action: { label: 'Sign in', url: loginLink },
    }),
  });
}

async function sendRejectedEmail(to: string, reason: string | null): Promise<void> {
  await sendTransactionalEmail({
    to,
    subject: 'Update on your registration',
    text: `Your registration was not approved.${reason ? ` Reason: ${reason}` : ''}`,
    html: renderEmailHtml({
      preheader: 'Your registration was not approved.',
      badge: { label: 'Not approved', tone: 'danger' },
      title: 'Registration not approved',
      message: 'We could not approve your registration.',
      note: reason ? { label: 'Reason', text: reason, tone: 'danger' } : undefined,
    }),
  });
}

// --- public: self-register ------------------------------------------------------------------------

/** Result of a self-registration (email must still be OTP-verified before sign-in). */
export interface SelfRegisterResult {
  userId: string;
  emailId: string;
  registerAs: RegistrationKind;
}

/**
 * Public self-registration. Atomically enough: provisions the dealer/agent firm (PENDING approval),
 * creates the login user (email UNVERIFIED) linked to it, and issues a signup email OTP. The account
 * cannot access the app until (a) the email is verified via OTP and (b) a super-admin approves it.
 * If linking the user fails after the firm is created, the firm is rolled back.
 *
 * @param input - registerAs + firm/contact fields + chosen password.
 * @throws 4091 if an account with the email already exists.
 */
export async function selfRegister(input: SelfRegisterBody): Promise<SelfRegisterResult> {
  const registerAs: RegistrationKind = input.registerAs === 'DEALER' ? 'dealer' : 'agent';
  const emailId = input.emailId.trim().toLowerCase();

  const existingUser = await findUserByEmail(emailId);
  if (existingUser) {
    // A VERIFIED account is a real one — send them to sign-in, don't overwrite it.
    if (existingUser.emailVerified) {
      throw new AppError(
        'An account with this email already exists. Please sign in instead.',
        StatusCodes.CONFLICT,
        4091,
      );
    }
    // An UNVERIFIED account is an abandoned registration (e.g. the browser was closed before the
    // OTP step). Discard it — user + link (cascade) + its firm — so this fresh submission replaces
    // it and the same email can be registered again.
    const [oldDealerId, oldAgentId] = await Promise.all([
      getPrimaryDealerIdForUser(existingUser.userId),
      getPrimaryAgentIdForUser(existingUser.userId),
    ]);
    await deleteUser(existingUser.userId);
    if (oldDealerId) await dealerRepository.deleteDealer(oldDealerId);
    if (oldAgentId) await agentRepository.deleteAgent(oldAgentId);
  }

  const applicantName = input.applicantName.trim();
  const firmName = input.firmName.trim();
  const mobileNo = input.mobileNo.trim();

  // 1) Provision the firm (PENDING approval).
  let firmId: string;
  if (registerAs === 'dealer') {
    const dealer = await createDealer({
      firmName,
      dealerName: applicantName,
      displayName: firmName,
      emailId,
      mobileNo,
      whatsappNo: input.whatsappNo?.trim() || mobileNo,
      address: input.address?.trim() || '',
      city: input.city?.trim() || '',
      state: input.state?.trim() || '',
      pincode: input.pincode?.trim() || '',
      isSubscribe: false,
      approvalStatus: 'PENDING',
    });
    firmId = dealer.dealerId;
  } else {
    const agent = await createAgent({
      firmName,
      agentName: applicantName,
      displayName: firmName,
      emailId,
      mobileNo,
      whatsappNo: input.whatsappNo?.trim() || null,
      address: input.address?.trim() || null,
      city: input.city?.trim() || null,
      state: input.state?.trim() || null,
      pincode: input.pincode?.trim() || null,
      approvalStatus: 'PENDING',
    });
    firmId = agent.agentId;
  }

  // 2) Create the login user (UNVERIFIED) linked to the firm; roll back the firm on failure.
  let userId: string;
  try {
    if (registerAs === 'dealer') {
      const link = await createDealerWiseUserWithUser({
        dealerId: firmId,
        userName: applicantName,
        emailId,
        mobileNo,
        password: input.password,
        emailVerified: false,
        // The account that registers the dealership is its OWNER (full access, manages roles).
        isOwner: true,
      });
      userId = link.user.userId;
    } else {
      const link = await createAgentWiseUserWithUser({
        agentId: firmId,
        userName: applicantName,
        emailId,
        mobileNo,
        password: input.password,
        emailVerified: false,
      });
      userId = link.user.userId;
    }
  } catch (err) {
    if (registerAs === 'dealer') {
      await dealerRepository.deleteDealer(firmId).catch(() => undefined);
    } else {
      await agentRepository.deleteAgent(firmId).catch(() => undefined);
    }
    throw err;
  }

  // 3) Send the email-verification OTP (best-effort; user can resend).
  const user = await findUserById(userId);
  if (user) {
    await issueSignupOtp(user).catch(() => undefined);
  }

  return { userId, emailId, registerAs };
}

// --- super-admin: list / approve / reject ---------------------------------------------------------

/** Maps a dealer row to the unified registration DTO. */
function dealerToDto(d: {
  dealerId: string;
  firmName: string;
  dealerName: string;
  emailId: string | null;
  mobileNo: string | null;
  approvalStatus: ApprovalStatus;
  approvalReason: string | null;
  createdAt: Date;
}): RegistrationDto {
  return {
    kind: 'dealer',
    id: d.dealerId,
    firmName: d.firmName,
    applicantName: d.dealerName,
    emailId: d.emailId,
    mobileNo: d.mobileNo,
    approvalStatus: d.approvalStatus,
    approvalReason: d.approvalReason,
    createdAt: d.createdAt,
  };
}

/** Maps an agent row to the unified registration DTO. */
function agentToDto(a: {
  agentId: string;
  firmName: string;
  agentName: string;
  emailId: string | null;
  mobileNo: string | null;
  approvalStatus: ApprovalStatus;
  approvalReason: string | null;
  createdAt: Date;
}): RegistrationDto {
  return {
    kind: 'agent',
    id: a.agentId,
    firmName: a.firmName,
    applicantName: a.agentName,
    emailId: a.emailId,
    mobileNo: a.mobileNo,
    approvalStatus: a.approvalStatus,
    approvalReason: a.approvalReason,
    createdAt: a.createdAt,
  };
}

/**
 * Lists self-registration requests (merged dealers + agents), default PENDING+REJECTED, newest
 * first, paginated in memory. Pass `status` to narrow to one state.
 */
export async function listRegistrations(
  query: PaginationQuery & { status?: ApprovalStatus },
): Promise<PaginatedResult<RegistrationDto>> {
  const statuses: ApprovalStatus[] = query.status ? [query.status] : ['PENDING', 'REJECTED'];
  const [dealers, agents] = await Promise.all([
    dealerRepository.listDealersByApprovalStatuses(statuses),
    agentRepository.listAgentsByApprovalStatuses(statuses),
  ]);
  const merged = [...dealers.map(dealerToDto), ...agents.map(agentToDto)].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
  const { skip, take } = parsePagination(query);
  const page = merged.slice(skip, skip + take);
  return { data: page, meta: buildPaginationMeta(merged.length, query) };
}

/** Loads a registration firm (dealer/agent) or throws 404. */
async function getFirmOrThrow(kind: RegistrationKind, id: string): Promise<RegistrationDto> {
  if (kind === 'dealer') {
    const dealer = await dealerRepository.findDealerById(id);
    if (!dealer) throw new AppError('Registration not found', StatusCodes.NOT_FOUND, 4065);
    return dealerToDto(dealer);
  }
  const agent = await agentRepository.findAgentById(id);
  if (!agent) throw new AppError('Registration not found', StatusCodes.NOT_FOUND, 4065);
  return agentToDto(agent);
}

/**
 * Approves a self-registration: unlocks access (APPROVED, reason cleared). A dealer is also marked
 * subscribed so it's immediately usable. Emails the applicant.
 */
export async function approveRegistration(kind: RegistrationKind, id: string): Promise<RegistrationDto> {
  const firm = await getFirmOrThrow(kind, id);
  if (kind === 'dealer') {
    await dealerRepository.setDealerApproval(id, 'APPROVED', null);
    await dealerRepository.setDealerSubscription(id, true);
  } else {
    await agentRepository.setAgentApproval(id, 'APPROVED', null);
  }
  if (firm.emailId) {
    await sendApprovedEmail(firm.emailId, kind).catch(() => undefined);
  }
  return { ...firm, approvalStatus: 'APPROVED', approvalReason: null };
}

/**
 * Rejects a self-registration (REJECTED + reason). The account stays but is blocked from the app.
 * Emails the applicant.
 */
export async function rejectRegistration(
  kind: RegistrationKind,
  id: string,
  reason?: string | null,
): Promise<RegistrationDto> {
  const firm = await getFirmOrThrow(kind, id);
  const trimmed = reason?.trim() || null;
  if (kind === 'dealer') {
    await dealerRepository.setDealerApproval(id, 'REJECTED', trimmed);
  } else {
    await agentRepository.setAgentApproval(id, 'REJECTED', trimmed);
  }
  if (firm.emailId) {
    await sendRejectedEmail(firm.emailId, trimmed).catch(() => undefined);
  }
  return { ...firm, approvalStatus: 'REJECTED', approvalReason: trimmed };
}
