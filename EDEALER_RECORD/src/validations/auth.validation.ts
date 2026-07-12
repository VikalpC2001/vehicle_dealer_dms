import { z } from 'zod';

/** OTP flow purpose (matches Prisma `OtpPurpose`). */
export const otpPurposeSchema = z.enum(['SIGNUP_EMAIL_VERIFICATION', 'PASSWORD_RESET']);

export const registerBodySchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    userName: z.string().min(1).optional(),
    mobileNo: z.string().max(20).optional(),
    gender: z.string().max(50).optional(),
  }),
});

export const loginBodySchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
  }),
});

export const refreshBodySchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  }),
});

export const passkeyRegisterOptionsBodySchema = z.object({
  body: z.object({
    userId: z.string().uuid('Invalid user ID'),
  }),
});

export const passkeyRegisterVerifyBodySchema = z.object({
  body: z.object({
    userId: z.string().uuid('Invalid user ID'),
    credential: z.record(z.unknown()),
  }),
});

export const passkeyLoginOptionsBodySchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
  }),
});

export const passkeyLoginVerifyBodySchema = z.object({
  body: z.object({
    credential: z.record(z.unknown()),
  }),
});

export const verifyOtpBodySchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    otp: z
      .string()
      .regex(/^\d{6}$/, 'OTP must be exactly 6 digits'),
    purpose: otpPurposeSchema,
  }),
});

export const resendOtpBodySchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    purpose: otpPurposeSchema,
  }),
});

export const forgotPasswordBodySchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
  }),
});

export const resetPasswordBodySchema = z.object({
  body: z.object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
  }),
});

export type RegisterBody = z.infer<typeof registerBodySchema>['body'];
export type LoginBody = z.infer<typeof loginBodySchema>['body'];
export type RefreshBody = z.infer<typeof refreshBodySchema>['body'];
export type PasskeyRegisterOptionsBody = z.infer<typeof passkeyRegisterOptionsBodySchema>['body'];
export type PasskeyRegisterVerifyBody = z.infer<typeof passkeyRegisterVerifyBodySchema>['body'];
export type PasskeyLoginOptionsBody = z.infer<typeof passkeyLoginOptionsBodySchema>['body'];
export type PasskeyLoginVerifyBody = z.infer<typeof passkeyLoginVerifyBodySchema>['body'];
export type VerifyOtpBody = z.infer<typeof verifyOtpBodySchema>['body'];
export type ResendOtpBody = z.infer<typeof resendOtpBodySchema>['body'];
export type ForgotPasswordBody = z.infer<typeof forgotPasswordBodySchema>['body'];
export type ResetPasswordBody = z.infer<typeof resetPasswordBodySchema>['body'];
