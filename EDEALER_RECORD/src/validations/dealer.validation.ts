import { z } from 'zod';

const dealerBodyFields = {
  firmName: z.string().min(1, 'Firm name is required').max(255),
  dealerName: z.string().min(1, 'Dealer name is required').max(255),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required').max(100),
  state: z.string().min(1, 'State is required').max(100),
  pincode: z.string().min(1, 'Pincode is required').max(10),
  mobileNo: z.string().min(1, 'Mobile number is required').max(20),
  emailId: z.string().email('Invalid email').max(255),
  displayName: z.string().min(1, 'Display name is required').max(255),
  whatsappNo: z.string().min(1, 'WhatsApp number is required').max(20),
};

export const createDealerSchema = z.object({
  body: z.object({
    ...dealerBodyFields,
    isSubscribe: z.boolean().optional().default(false),
  }),
});

export const updateDealerSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid dealer ID'),
  }),
  body: z.object({
    ...dealerBodyFields,
    isSubscribe: z.boolean(),
  }),
});

export const getDealerByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid dealer ID'),
  }),
});

export const listDealersSchema = z.object({
  query: z.object({
    page: z.coerce.number().optional(),
    limit: z.coerce.number().optional(),
  }),
});

export type CreateDealerBody = z.infer<typeof createDealerSchema>['body'];
export type UpdateDealerBody = z.infer<typeof updateDealerSchema>['body'];
export type DealerIdParams = z.infer<typeof getDealerByIdSchema>['params'];
