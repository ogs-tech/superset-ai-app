import { z } from 'zod';
import type { SkillId } from '../../domain/skill-id.js';
import type { CustomizationSource } from '../../domain/customization-source.js';
import { commonFrontmatterSchema } from './common.js';

export const skillSchema = commonFrontmatterSchema
  .extend({ type: z.literal('skill') })
  .passthrough();

export type SkillFrontmatter = z.infer<typeof skillSchema>;

export interface SkillSummary {
  id: SkillId;
  frontmatter: SkillFrontmatter;
  source: CustomizationSource;
}

export interface Skill extends SkillSummary {
  body: string;
}
