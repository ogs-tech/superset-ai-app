import { z } from 'zod';

const directorySourceSchema = z
  .object({
    source: z.literal('directory'),
    path: z.string(),
  })
  .passthrough();

const githubSourceSchema = z
  .object({
    source: z.literal('github'),
    repo: z.string(),
  })
  .passthrough();

const gitSourceSchema = z
  .object({
    source: z.literal('git'),
    url: z.string(),
    ref: z.string().optional(),
  })
  .passthrough();

const urlSourceSchema = z
  .object({
    source: z.literal('url'),
    url: z.string(),
  })
  .passthrough();

const marketplaceInnerSourceSchema = z.union([
  directorySourceSchema,
  githubSourceSchema,
  gitSourceSchema,
  urlSourceSchema,
]);

const marketplaceSourceSchema = z
  .object({
    source: marketplaceInnerSourceSchema,
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
