import { z } from 'zod';
import { commonFrontmatterSchema } from './common.js';

export const globalInstructionSchema = commonFrontmatterSchema
  .extend({
    type: z.literal('global-instruction'),
    name: z.enum(['claude', 'copilot'], { message: 'global-instruction name must be "claude" or "copilot"' }),
    scopes: z.tuple([z.literal('personal')], { message: 'global-instruction scopes must be exactly ["personal"]' }),
  })
  .passthrough();

export type GlobalInstructionFrontmatter = z.infer<typeof globalInstructionSchema>;
