import { z } from 'zod';

export const createAgentWiseUserSchema = z.object({
  body: z.object({
    agentId: z.string().uuid('Invalid agent ID').optional(),
    userId: z.string().uuid('Invalid user ID'),
  }),
});

export const createAgentWiseUserWithUserSchema = z.object({
  body: z.object({
    agentId: z.string().uuid('Invalid agent ID').optional(),
    userName: z.string().trim().min(1, 'userName is required'),
    emailId: z.string().trim().email('Invalid email').toLowerCase(),
    mobileNo: z.string().trim().min(1, 'mobileNo is required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
  }),
});

export const listAgentWiseUsersSchema = z.object({
  query: z.object({
    agentId: z.string().uuid('Invalid agent ID').optional(),
  }),
});

export const agentWiseUserIdParamsSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid awu ID'),
  }),
});

export const updateAgentWiseUserSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid awu ID'),
  }),
  body: z.object({
    userId: z.string().uuid('Invalid user ID'),
  }),
});

export type CreateAgentWiseUserBody = z.infer<typeof createAgentWiseUserSchema>['body'];
export type CreateAgentWiseUserWithUserBody = z.infer<
  typeof createAgentWiseUserWithUserSchema
>['body'];
export type UpdateAgentWiseUserBody = z.infer<typeof updateAgentWiseUserSchema>['body'];
export type AgentWiseUserIdParams = z.infer<typeof agentWiseUserIdParamsSchema>['params'];
