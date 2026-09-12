import { z } from 'zod';

/**
 * PATCH /dealers/:id/subscription  ·  PATCH /agents/:id/subscription
 * Super-admin toggles a dealer's or agent's subscription flag.
 */
export const setSubscriptionSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid ID'),
  }),
  body: z.object({
    isSubscribe: z.boolean({ required_error: 'isSubscribe is required' }),
  }),
});

export type SetSubscriptionParams = z.infer<typeof setSubscriptionSchema>['params'];
export type SetSubscriptionBody = z.infer<typeof setSubscriptionSchema>['body'];
