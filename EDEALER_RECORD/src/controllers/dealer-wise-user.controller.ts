import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import {
  createDealerWiseUser,
  createDealerWiseUserWithUser,
  listDealerWiseUsers,
  getDealerWiseUserById,
  updateDealerWiseUser,
  deleteDealerWiseUser,
} from '../services/dealer-wise-user.service';
import { sendSuccess } from '../utils/api-response';
import { assertDealerMatchesToken, resolveDealerIdFromRequest } from '../utils/dealer-scope';
import type {
  CreateDealerWiseUserBody,
  CreateDealerWiseUserWithUserBody,
  UpdateDealerWiseUserBody,
  DealerWiseUserIdParams,
} from '../validations/dealer-wise-user.validation';

/**
 * POST /dealer-wise-users
 */
export async function createDealerWiseUserHandler(req: Request, res: Response): Promise<void> {
  const body = req.body as CreateDealerWiseUserBody;
  const dealerId = resolveDealerIdFromRequest(req, body.dealerId);
  const row = await createDealerWiseUser({ ...body, dealerId });
  sendSuccess(res, 'Dealer user assignment created', row, StatusCodes.CREATED);
}

/**
 * POST /dealer-wise-users/with-user
 */
export async function createDealerWiseUserWithUserHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const body = req.body as CreateDealerWiseUserWithUserBody;
  const dealerId = resolveDealerIdFromRequest(req, body.dealerId);
  const row = await createDealerWiseUserWithUser({
    dealerId,
    userName: body.userName,
    emailId: body.emailId,
    mobileNo: body.mobileNo,
    password: body.password,
  });
  sendSuccess(res, 'Dealer user created and assigned', row, StatusCodes.CREATED);
}

/**
 * GET /dealer-wise-users?dealerId=
 */
export async function listDealerWiseUsersHandler(req: Request, res: Response): Promise<void> {
  const q = req.query as { dealerId?: string };
  const dealerId = resolveDealerIdFromRequest(req, q.dealerId);
  const items = await listDealerWiseUsers(dealerId);
  sendSuccess(res, 'Dealer user assignments retrieved', items);
}

/**
 * GET /dealer-wise-users/:id (`id` = `dwuId`)
 */
export async function getDealerWiseUserByIdHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as DealerWiseUserIdParams;
  const row = await getDealerWiseUserById(id);
  assertDealerMatchesToken(req, row.dealerId);
  sendSuccess(res, 'Dealer user assignment retrieved', row);
}

/**
 * PATCH /dealer-wise-users/:id
 */
export async function updateDealerWiseUserHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as DealerWiseUserIdParams;
  const body = req.body as UpdateDealerWiseUserBody;
  const current = await getDealerWiseUserById(id);
  assertDealerMatchesToken(req, current.dealerId);
  const row = await updateDealerWiseUser(id, body);
  sendSuccess(res, 'Dealer user assignment updated', row);
}

/**
 * DELETE /dealer-wise-users/:id
 */
export async function deleteDealerWiseUserHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as DealerWiseUserIdParams;
  const current = await getDealerWiseUserById(id);
  assertDealerMatchesToken(req, current.dealerId);
  await deleteDealerWiseUser(id);
  sendSuccess(res, 'Dealer user assignment deleted', {});
}
