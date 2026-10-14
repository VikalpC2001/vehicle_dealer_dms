import { z } from 'zod';

/**
 * PATCH /dealers/:id/access  ·  PATCH /agents/:id/access
 * Super-admin pauses (`isActive: false`) or resumes (`isActive: true`) a dealer's or agent's access.
 */
export const setFirmAccessSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid ID'),
  }),
  body: z.object({
    isActive: z.boolean({ required_error: 'isActive is required' }),
  }),
});

export type SetFirmAccessParams = z.infer<typeof setFirmAccessSchema>['params'];
export type SetFirmAccessBody = z.infer<typeof setFirmAccessSchema>['body'];
