import { z } from 'zod';
import { commonFrontmatterSchema } from './common.js';

export const templateSchema = commonFrontmatterSchema
  .extend({
    type: z.literal('template'),
    targetType: z.enum(['skill', 'reference', 'agent', 'global-instruction'], {
      message: 'targetType is required and must be one of skill | reference | agent | global-instruction',
    }),
  })
  .passthrough();

export type TemplateFrontmatter = z.infer<typeof templateSchema>;
