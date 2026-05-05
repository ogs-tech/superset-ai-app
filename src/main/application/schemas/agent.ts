import { z } from 'zod';
import type { AgentId } from '../../domain/agent-id.js';
import type { CustomizationSource } from '../../domain/customization-source.js';
import { commonFrontmatterSchema } from './common.js';

export const agentSchema = commonFrontmatterSchema
  .extend({ type: z.literal('agent') })
  .passthrough();

export type AgentFrontmatter = z.infer<typeof agentSchema>;

export interface AgentSummary {
  id: AgentId;
  frontmatter: AgentFrontmatter;
  source: CustomizationSource;
}

export interface Agent extends AgentSummary {
  body: string;
}
