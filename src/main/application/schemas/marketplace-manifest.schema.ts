import { z } from 'zod';

const marketplacePluginSchema = z
  .object({
    name: z.string(),
    description: z.string(),
    author: z.object({ name: z.string() }).optional(),
    category: z.string().optional(),
    source: z.unknown(),
    homepage: z.string().optional(),
  })
  .passthrough();

const ownerSchema = z
  .object({
    name: z.string(),
    email: z.string().optional(),
  })
  .passthrough();

export const marketplaceManifestSchema = z
  .object({
    name: z.string(),
    owner: ownerSchema.optional(),
    description: z.string().optional(),
    plugins: z.array(marketplacePluginSchema),
  })
  .passthrough();
