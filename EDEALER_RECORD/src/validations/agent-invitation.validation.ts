import { z } from 'zod';

/**
 * POST /agent-invitations
 * A dealer invites a brand-new agent by email. Name + email are required; mobile optional.
 */
export const createAgentInvitationSchema = z.object({
  body: z.object({
    agentName: z.string().trim().min(2, 'Agent name is required'),
    emailId: z.string().trim().email('A valid email is required'),
    mobileNo: z.string().trim().min(7, 'Enter a valid mobile number').max(20).optional(),
  }),
});

/**
 * Params for invitation-scoped dealer actions (resend / cancel).
 */
export const agentInvitationIdParamsSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid invitation ID'),
  }),
});

/**
 * GET /agent-invitations/accept/:token (public prefill).
 */
export const acceptInvitationTokenParamsSchema = z.object({
  params: z.object({
    token: z.string().min(16, 'Invalid invitation token'),
  }),
});

/**
 * POST /agent-invitations/accept/:token (public onboarding).
 * The invited email is taken from the invitation server-side — never from the body.
 */
export const acceptInvitationSchema = z.object({
  params: z.object({
    token: z.string().min(16, 'Invalid invitation token'),
  }),
  body: z.object({
    firmName: z.string().trim().min(2, 'Firm name is required'),
    agentName: z.string().trim().min(2, 'Agent name is required'),
    displayName: z.string().trim().min(2, 'Display name is required'),
    mobileNo: z.string().trim().min(7, 'Enter a valid mobile number').max(20),
    address: z.string().trim().max(500).optional(),
    city: z.string().trim().max(100).optional(),
    state: z.string().trim().max(100).optional(),
    pincode: z.string().trim().max(10).optional(),
    whatsappNo: z.string().trim().max(20).optional(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
  }),
});

export type CreateAgentInvitationBody = z.infer<typeof createAgentInvitationSchema>['body'];
export type AgentInvitationIdParams = z.infer<typeof agentInvitationIdParamsSchema>['params'];
export type AcceptInvitationTokenParams = z.infer<
  typeof acceptInvitationTokenParamsSchema
>['params'];
export type AcceptInvitationBody = z.infer<typeof acceptInvitationSchema>['body'];
