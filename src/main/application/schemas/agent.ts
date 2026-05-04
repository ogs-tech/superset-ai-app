import { z } from 'zod';
import { commonFrontmatterSchema } from './common.js';

export const agentSchema = commonFrontmatterSchema
  .extend({ type: z.literal('agent') })
  .passthrough();

export type AgentFrontmatter = z.infer<typeof agentSchema>;
