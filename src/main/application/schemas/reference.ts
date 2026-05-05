import { z } from 'zod';
import type { ReferenceId } from '../../domain/reference-id.js';
import type { CustomizationSource } from '../../domain/customization-source.js';
import { commonFrontmatterSchema } from './common.js';

export const referenceSchema = commonFrontmatterSchema
  .extend({
    type: z.literal('reference'),
  })
  .passthrough();

export type ReferenceFrontmatter = z.infer<typeof referenceSchema>;

export interface ReferenceSummary {
  id: ReferenceId;
  frontmatter: ReferenceFrontmatter;
  source: CustomizationSource;
}

export interface Reference extends ReferenceSummary {
  body: string;
}
