import { z } from 'zod';

export const createDealerWiseUserSchema = z.object({
  body: z.object({
    dealerId: z.string().uuid('Invalid dealer ID').optional(),
    userId: z.string().uuid('Invalid user ID'),
  }),
});

export const createDealerWiseUserWithUserSchema = z.object({
  body: z.object({
    dealerId: z.string().uuid('Invalid dealer ID').optional(),
    userName: z.string().trim().min(1, 'userName is required'),
    emailId: z.string().trim().email('Invalid email').toLowerCase(),
    mobileNo: z.string().trim().min(1, 'mobileNo is required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
  }),
});

export const listDealerWiseUsersSchema = z.object({
  query: z.object({
    dealerId: z.string().uuid('Invalid dealer ID').optional(),
  }),
});

export const dealerWiseUserIdParamsSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid dwu ID'),
  }),
});

export const updateDealerWiseUserSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid dwu ID'),
  }),
  body: z.object({
    userId: z.string().uuid('Invalid user ID'),
  }),
});

export type CreateDealerWiseUserBody = z.infer<typeof createDealerWiseUserSchema>['body'];
export type CreateDealerWiseUserWithUserBody = z.infer<
  typeof createDealerWiseUserWithUserSchema
>['body'];
export type UpdateDealerWiseUserBody = z.infer<typeof updateDealerWiseUserSchema>['body'];
export type DealerWiseUserIdParams = z.infer<typeof dealerWiseUserIdParamsSchema>['params'];
