import { z } from 'zod';
import { commonFrontmatterSchema } from './common.js';

export const referenceSchema = commonFrontmatterSchema
  .extend({
    type: z.literal('reference'),
    includeInCopilotInstructions: z.boolean().optional(),
  })
  .passthrough();

export type ReferenceFrontmatter = z.infer<typeof referenceSchema>;
