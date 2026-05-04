import { z } from 'zod';

const marketplaceSourceSchema = z
  .object({
    source: z.object({
      source: z.literal('local'),
      path: z.string(),
    }),
  })
  .passthrough();

const extraKnownMarketplacesSchema = z.record(z.string(), marketplaceSourceSchema).default({});

const enabledPluginsSchema = z.record(z.string(), z.boolean()).default({});

export const claudeSettingsSchema = z
  .object({
    extraKnownMarketplaces: extraKnownMarketplacesSchema,
    enabledPlugins: enabledPluginsSchema,
  })
  .passthrough();

export type ClaudeSettings = z.infer<typeof claudeSettingsSchema>;
