import { z } from 'zod';

const tagNameField = z.string().trim().min(1, 'Tag name is required').max(255);
const colourField = z.string().trim().max(50, 'Colour is too long');

/**
 * POST /dealer-tags — create a tag for the resolved dealer.
 */
export const createDealerTagSchema = z.object({
  body: z.object({
    dealerId: z.string().uuid('Invalid dealer ID').optional(),
    tagName: tagNameField,
    colour: colourField.optional(),
  }),
});

/**
 * PATCH /dealer-tags/:id — update a tag's name and/or colour.
 */
export const updateDealerTagSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid dealer tag ID'),
  }),
  body: z.object({
    tagName: tagNameField.optional(),
    colour: colourField.optional(),
  }),
});

/**
 * GET /dealer-tags — list the resolved dealer's tags. Agents/super-admin may pass `dealerId`.
 */
export const listDealerTagsSchema = z.object({
  query: z.object({
    dealerId: z.string().uuid('Invalid dealer ID').optional(),
  }),
});

/**
 * DELETE /dealer-tags/:id — delete a tag (identifies the tag by path param only).
 */
export const dealerTagIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid dealer tag ID'),
  }),
});

export type CreateDealerTagBody = z.infer<typeof createDealerTagSchema>['body'];
export type UpdateDealerTagBody = z.infer<typeof updateDealerTagSchema>['body'];
export type ListDealerTagsQuery = z.infer<typeof listDealerTagsSchema>['query'];
export type DealerTagIdParams = z.infer<typeof dealerTagIdSchema>['params'];
