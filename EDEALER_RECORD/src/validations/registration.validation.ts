import { z } from 'zod';

/** Public self-registration (dealer/agent). Contact/address beyond the essentials are optional. */
export const selfRegisterSchema = z.object({
  body: z.object({
    registerAs: z.enum(['DEALER', 'AGENT'], { required_error: 'Choose dealer or agent' }),
    applicantName: z.string().min(2, 'Your name is required').max(255),
    firmName: z.string().min(2, 'Firm / business name is required').max(255),
    emailId: z.string().email('Invalid email').max(255),
    mobileNo: z.string().min(7, 'Enter a valid mobile number').max(20),
    password: z.string().min(8, 'Password must be at least 8 characters').max(255),
    whatsappNo: z.string().max(20).optional().nullable(),
    address: z.string().max(2000).optional().nullable(),
    city: z.string().max(100).optional().nullable(),
    state: z.string().max(100).optional().nullable(),
    pincode: z.string().max(10).optional().nullable(),
  }),
});

/** Super-admin list of registration requests. */
export const listRegistrationsSchema = z.object({
  query: z.object({
    page: z.coerce.number().optional(),
    limit: z.coerce.number().optional(),
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  }),
});

/** Params for approve/reject: kind (dealer|agent) + firm id. */
export const registrationActionParamsSchema = z.object({
  params: z.object({
    kind: z.enum(['dealer', 'agent'], { required_error: 'Invalid registration kind' }),
    id: z.string().uuid('Invalid id'),
  }),
});

/** Reject with an optional reason (emailed to the applicant). */
export const rejectRegistrationSchema = z.object({
  params: z.object({
    kind: z.enum(['dealer', 'agent']),
    id: z.string().uuid('Invalid id'),
  }),
  body: z.object({
    reason: z.string().max(2000).optional().nullable(),
  }),
});

export type SelfRegisterBody = z.infer<typeof selfRegisterSchema>['body'];
export type ListRegistrationsQuery = z.infer<typeof listRegistrationsSchema>['query'];
export type RegistrationActionParams = z.infer<typeof registrationActionParamsSchema>['params'];
export type RejectRegistrationBody = z.infer<typeof rejectRegistrationSchema>['body'];
