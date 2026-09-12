import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import {
  selfRegister,
  listRegistrations,
  approveRegistration,
  rejectRegistration,
} from '../services/registration.service';
import { sendSuccess, sendPaginated } from '../utils/api-response';
import { assertSuperAdmin } from '../utils/dealer-scope';
import type {
  SelfRegisterBody,
  ListRegistrationsQuery,
  RegistrationActionParams,
  RejectRegistrationBody,
} from '../validations/registration.validation';

/**
 * POST /registrations — public self-registration (dealer/agent). Creates a PENDING account and
 * sends an email-verification OTP. The client then verifies via POST /auth/verify-otp.
 */
export async function selfRegisterHandler(req: Request, res: Response): Promise<void> {
  const body = req.body as SelfRegisterBody;
  const result = await selfRegister(body);
  sendSuccess(
    res,
    'Account created. Enter the verification code sent to your email.',
    { emailId: result.emailId, registerAs: result.registerAs },
    StatusCodes.CREATED,
  );
}

/**
 * GET /registrations — super-admin list of registration requests (default PENDING + REJECTED).
 */
export async function listRegistrationsHandler(req: Request, res: Response): Promise<void> {
  assertSuperAdmin(req);
  const query = req.query as unknown as ListRegistrationsQuery;
  const result = await listRegistrations(query);
  sendPaginated(res, 'Registrations retrieved', result.data, result.meta);
}

/**
 * POST /registrations/:kind/:id/approve — super-admin approves a registration (unlocks access).
 */
export async function approveRegistrationHandler(req: Request, res: Response): Promise<void> {
  assertSuperAdmin(req);
  const { kind, id } = req.params as unknown as RegistrationActionParams;
  const result = await approveRegistration(kind, id);
  sendSuccess(res, 'Registration approved', result);
}

/**
 * POST /registrations/:kind/:id/reject — super-admin rejects a registration (blocks access).
 */
export async function rejectRegistrationHandler(req: Request, res: Response): Promise<void> {
  assertSuperAdmin(req);
  const { kind, id } = req.params as unknown as RegistrationActionParams;
  const { reason } = req.body as RejectRegistrationBody;
  const result = await rejectRegistration(kind, id, reason);
  sendSuccess(res, 'Registration rejected', result);
}
