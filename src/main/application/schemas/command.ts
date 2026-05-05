import { z } from 'zod';
import type { CommandId } from '../../domain/command-id.js';
import type { CustomizationSource } from '../../domain/customization-source.js';
import { commonFrontmatterSchema } from './common.js';

export const commandSchema = commonFrontmatterSchema
  .extend({ type: z.literal('command') })
  .passthrough();

export type CommandFrontmatter = z.infer<typeof commandSchema>;

export interface CommandSummary {
  id: CommandId;
  frontmatter: CommandFrontmatter;
  source: CustomizationSource;
}

export interface Command extends CommandSummary {
  body: string;
}
