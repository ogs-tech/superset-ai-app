import { z } from 'zod';
import { commonFrontmatterSchema } from './common.js';

export const referenceSchema = commonFrontmatterSchema
  .extend({
    type: z.literal('reference'),
  })
  .passthrough();

export type ReferenceFrontmatter = z.infer<typeof referenceSchema>;
