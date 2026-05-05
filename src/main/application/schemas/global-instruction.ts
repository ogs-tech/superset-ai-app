import { z } from 'zod';
import type { GlobalInstructionId } from '../../domain/global-instruction-id.js';
import type { CustomizationSource } from '../../domain/customization-source.js';
import { commonFrontmatterSchema } from './common.js';

export const globalInstructionSchema = commonFrontmatterSchema
  .extend({
    type: z.literal('global-instruction'),
    name: z.literal('default', { message: 'global-instruction name must be "default"' }),
    scopes: z.tuple([z.literal('personal')], { message: 'global-instruction scopes must be exactly ["personal"]' }),
  })
  .passthrough();

export type GlobalInstructionFrontmatter = z.infer<typeof globalInstructionSchema>;

export interface GlobalInstructionSummary {
  id: GlobalInstructionId;
  frontmatter: GlobalInstructionFrontmatter;
  source: CustomizationSource;
}

export interface GlobalInstruction extends GlobalInstructionSummary {
  body: string;
}
