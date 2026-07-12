import { StatusCodes } from 'http-status-codes';
import type { Dealer } from '@prisma/client';
import * as dealerRepository from '../repositories/dealer.repository';
import { AppError } from '../utils/app-error';
import { parsePagination, buildPaginationMeta } from '../utils/pagination';
import type { PaginationQuery, PaginatedResult } from '../types';

/**
 * Input for creating a new dealer. All fields required; emailId, mobileNo, and whatsappNo must be unique.
 */
export interface CreateDealerInput {
  firmName: string;
  dealerName: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  mobileNo: string;
  emailId: string;
  displayName: string;
  whatsappNo: string;
  isSubscribe?: boolean;
}

/**
 * Input for updating a dealer. All fields required; emailId, mobileNo, and whatsappNo must be unique (excluding current dealer).
 */
export interface UpdateDealerInput {
  firmName: string;
  dealerName: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  mobileNo: string;
  emailId: string;
  displayName: string;
  whatsappNo: string;
  isSubscribe: boolean;
}

/**
 * Creates a new dealer. Throws if emailId, mobileNo, or whatsappNo already exists.
 */
export async function createDealer(input: CreateDealerInput): Promise<Dealer> {
  const existingByEmail = await dealerRepository.findDealerByEmailId(input.emailId);
  if (existingByEmail) {
    throw new AppError('Email already registered for another dealer', StatusCodes.CONFLICT, 4094);
  }
  const existingByMobile = await dealerRepository.findDealerByMobileNo(input.mobileNo);
  if (existingByMobile) {
    throw new AppError('Mobile number already registered for another dealer', StatusCodes.CONFLICT, 4096);
  }
  const existingByWhatsapp = await dealerRepository.findDealerByWhatsappNo(input.whatsappNo);
  if (existingByWhatsapp) {
    throw new AppError('WhatsApp number already registered for another dealer', StatusCodes.CONFLICT, 4095);
  }
  return dealerRepository.createDealer({
    ...input,
    isSubscribe: input.isSubscribe ?? false,
  });
}

/**
 * Returns a paginated list of dealers.
 */
export async function listDealers(query: PaginationQuery): Promise<PaginatedResult<Dealer>> {
  const { skip, take } = parsePagination(query);
  const { items, total } = await dealerRepository.listDealers(skip, take);
  const meta = buildPaginationMeta(total, query);
  return { data: items, meta };
}

/**
 * Retrieves a single dealer by ID, or throws if not found.
 */
export async function getDealerById(dealerId: string): Promise<Dealer> {
  const dealer = await dealerRepository.findDealerById(dealerId);
  if (!dealer) {
    throw new AppError('Dealer not found', StatusCodes.NOT_FOUND, 4043);
  }
  return dealer;
}

/**
 * Updates an existing dealer. Throws if another dealer has the same emailId, mobileNo, or whatsappNo.
 */
export async function updateDealer(dealerId: string, input: UpdateDealerInput): Promise<Dealer> {
  await getDealerById(dealerId);
  const existingByEmail = await dealerRepository.findDealerByEmailId(input.emailId, dealerId);
  if (existingByEmail) {
    throw new AppError('Email already registered for another dealer', StatusCodes.CONFLICT, 4094);
  }
  const existingByMobile = await dealerRepository.findDealerByMobileNo(input.mobileNo, dealerId);
  if (existingByMobile) {
    throw new AppError('Mobile number already registered for another dealer', StatusCodes.CONFLICT, 4096);
  }
  const existingByWhatsapp = await dealerRepository.findDealerByWhatsappNo(input.whatsappNo, dealerId);
  if (existingByWhatsapp) {
    throw new AppError('WhatsApp number already registered for another dealer', StatusCodes.CONFLICT, 4095);
  }
  return dealerRepository.updateDealer(dealerId, input);
}

/**
 * Deletes a dealer by ID.
 */
export async function deleteDealer(dealerId: string): Promise<void> {
  await getDealerById(dealerId);
  await dealerRepository.deleteDealer(dealerId);
}
