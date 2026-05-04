import { z } from 'zod';
import { commonFrontmatterSchema } from './common.js';

export const skillSchema = commonFrontmatterSchema
  .extend({ type: z.literal('skill') })
  .passthrough();

export type SkillFrontmatter = z.infer<typeof skillSchema>;
