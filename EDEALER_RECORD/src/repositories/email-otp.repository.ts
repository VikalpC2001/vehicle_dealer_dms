import type { EmailOtp, OtpPurpose } from '@prisma/client';

import { prisma } from '../config/prisma';

/**
 * Replaces any existing OTP for the same email and purpose, then inserts a new row.
 */
export const createEmailOtp = async (params: {
  email: string;
  userId: string;
  purpose: OtpPurpose;
  otpHash: string;
  expiresAt: Date;
}): Promise<EmailOtp> => {
  await prisma.emailOtp.deleteMany({
    where: { email: params.email, purpose: params.purpose },
  });
  return prisma.emailOtp.create({
    data: {
      email: params.email,
      userId: params.userId,
      purpose: params.purpose,
      otpHash: params.otpHash,
      expiresAt: params.expiresAt,
    },
  });
};

/**
 * Returns the latest non-expired OTP row for email + purpose, if any.
 */
export const findLatestActiveOtp = async (
  email: string,
  purpose: OtpPurpose,
): Promise<EmailOtp | null> => {
  return prisma.emailOtp.findFirst({
    where: {
      email,
      purpose,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });
};

/**
 * Deletes an OTP row by id (after successful verification).
 */
export const deleteEmailOtpById = async (emailOtpId: string): Promise<void> => {
  await prisma.emailOtp.delete({ where: { emailOtpId } });
};
