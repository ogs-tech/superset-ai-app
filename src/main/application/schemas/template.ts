import { z } from 'zod';
import {
  descriptionSchema,
  isoDatetimeSchema,
  scopesSchema,
  slugSchema,
  tagsSchema,
  versionSchema,
} from './common.js';

export const templateSchema = z
  .object({
    name: slugSchema,
    targetType: z.enum(['skill', 'reference', 'agent', 'global-instruction'], {
      message: 'targetType must be one of skill | reference | agent | global-instruction',
    }),
    description: descriptionSchema,
    scopes: scopesSchema,
    version: versionSchema,
    createdAt: isoDatetimeSchema,
    updatedAt: isoDatetimeSchema,
    tags: tagsSchema,
  })
  .passthrough();

export type TemplateFrontmatterValidated = z.infer<typeof templateSchema>;
