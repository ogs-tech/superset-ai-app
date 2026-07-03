import { z } from 'zod';

const slug = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'name must match ^[a-z0-9][a-z0-9-]*$');
const version = z.string().regex(/^\d+\.\d+\.\d+(-[\w.-]+)?$/, 'version must follow semver');
const scopes = z
  .array(z.enum(['personal', 'project']))
  .min(1, 'scopes must have at least 1 entry')
  .refine((arr) => new Set(arr).size === arr.length, { message: 'scopes must not contain duplicates' });
const metadata = z.object({
  version,
  tags: z.array(z.string().regex(/^[a-z0-9-]+$/)).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
const source = z.object({ kind: z.enum(['workspace', 'plugin']) }).passthrough();

const entityBase = z.object({
  urn: z.string().min(1),
  name: slug,
  description: z.string().max(1024),
  scopes,
  metadata,
  source,
});

export const skillEntitySchema = entityBase
  .extend({ kind: z.literal('skill'), description: z.string().min(1).max(1024), content: z.string(), explicitOnly: z.boolean().optional() })
  .passthrough();

export const agentEntitySchema = entityBase
  .extend({ kind: z.literal('agent'), description: z.string().min(1).max(1024), systemPrompt: z.string() })
  .passthrough();

export const instructionEntitySchema = entityBase
  .extend({
    kind: z.literal('instruction'),
    name: z.literal('default', { message: 'instruction name must be "default"' }),
    scopes: z.tuple([z.literal('personal')], { message: 'instruction scopes must be exactly ["personal"]' }),
    content: z.string(),
    activation: z.enum(['always', 'glob', 'agent-requested', 'manual']),
    globs: z.array(z.string()).optional(),
  })
  .passthrough();
