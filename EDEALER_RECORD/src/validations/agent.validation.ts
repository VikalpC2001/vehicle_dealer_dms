import { z } from 'zod';

const agentBodyFields = {
  firmName: z.string().min(1, 'Firm name is required').max(255),
  agentName: z.string().min(1, 'Agent name is required').max(255),
  address: z.string().optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  pincode: z.string().max(10).optional(),
  mobileNo: z.string().max(20).optional(),
  emailId: z.string().email('Invalid email').max(255).optional(),
  displayName: z.string().min(1, 'Display name is required').max(255),
  whatsappNo: z.string().max(20).optional(),
};

export const createAgentSchema = z.object({
  body: z.object({
    ...agentBodyFields,
    isSubscribe: z.boolean().optional().default(false),
  }),
});

export const updateAgentSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid agent ID'),
  }),
  body: z.object({
    ...agentBodyFields,
    isSubscribe: z.boolean(),
  }),
});

export const getAgentByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid agent ID'),
  }),
});

/** PATCH /agents/me — the agent edits their own profile (no `isSubscribe`, no id param). */
export const updateMyAgentSchema = z.object({
  body: z.object(agentBodyFields),
});

/** Create a verified owner/staff user and link them to an agent (super-admin onboarding flow). */
export const createAgentWithUserSchema = z.object({
  body: z.object({
    agentId: z.string().uuid('Invalid agent ID'),
    userName: z.string().trim().min(1, 'userName is required'),
    emailId: z.string().trim().email('Invalid email').toLowerCase(),
    mobileNo: z.string().trim().min(1, 'mobileNo is required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
  }),
});

export const listAgentsSchema = z.object({
  query: z.object({
    page: z.coerce.number().optional(),
    limit: z.coerce.number().optional(),
  }),
});

export type CreateAgentBody = z.infer<typeof createAgentSchema>['body'];
export type UpdateAgentBody = z.infer<typeof updateAgentSchema>['body'];
export type UpdateMyAgentBody = z.infer<typeof updateMyAgentSchema>['body'];
export type AgentIdParams = z.infer<typeof getAgentByIdSchema>['params'];
export type CreateAgentWithUserBody = z.infer<typeof createAgentWithUserSchema>['body'];
