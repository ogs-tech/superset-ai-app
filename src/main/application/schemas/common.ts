import { z } from 'zod';

export const slugSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'slug must match ^[a-z0-9][a-z0-9-]*$');

export const versionSchema = z.string().regex(
  /^\d+\.\d+\.\d+(-[\w.-]+)?$/,
  'version must follow semver (e.g. 1.2.3 or 1.2.3-rc.1)',
);

export const descriptionSchema = z
  .string()
  .min(1, 'description must not be empty')
  .max(1024, 'description must be at most 1024 characters');

export const scopesSchema = z
  .array(z.enum(['personal', 'project']))
  .min(1, 'scopes must have at least 1 entry')
  .refine((arr) => new Set(arr).size === arr.length, { message: 'scopes must not contain duplicates' });

export const tagsSchema = z
  .array(z.string().regex(/^[a-z0-9-]+$/, 'each tag must match ^[a-z0-9-]+$'))
  .optional();

export const isoDatetimeSchema = z.string().datetime({ message: 'must be a valid ISO 8601 datetime' });

export const commonFrontmatterSchema = z.object({
  name: slugSchema,
  type: z.enum(['skill', 'reference', 'agent', 'global-instruction', 'template']),
  description: descriptionSchema,
  scopes: scopesSchema,
  version: versionSchema,
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
  tags: tagsSchema,
});
