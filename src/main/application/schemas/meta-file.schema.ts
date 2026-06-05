import { z } from 'zod';

// Ref schema — mirrors PluginRef domain type
const pluginRefSchema = z.object({
  kind: z.enum(['branch', 'tag', 'sha']),
  value: z.string().min(1),
});

// Source schema — mirrors PluginSource domain type
const pluginSourceSchema = z.object({
  kind: z.literal('git'),
  url: z.string(),
  ref: pluginRefSchema.optional(),
});

// Publish info schema — mirrors PluginPublishInfo domain type
const publishInfoSchema = z
  .object({
    remoteUrl: z.string(),
    visibility: z.enum(['public', 'private']),
    lastPublishedSha: z.string(),
    lastPublishedVersion: z.string(),
    lastPublishedAt: z.string(),
  })
  .passthrough();

// v2 entry schema
const metaEntryV2Schema = z
  .object({
    id: z.string().min(1),
    origin: z.enum(['imported', 'owned']),
    source: pluginSourceSchema.optional(),
    installedRef: pluginRefSchema.optional(),
    installedAt: z.string(),
    scope: z.enum(['personal', 'project']),
    enabled: z.boolean(),
    publish: publishInfoSchema.optional(),
    marketplaceId: z.string().min(1).optional(),
  })
  .passthrough();

// Accept both v1 and v2 input, always output v2.
// Migration rule:
//   - version absent or 1: set version=2, default origin='imported' on all entries
//   - version 2: validate normally
export const metaFileSchema = z.preprocess(
  (raw) => {
    if (typeof raw !== 'object' || raw === null) return raw;
    const obj = raw as Record<string, unknown>;

    if (!obj['version'] || obj['version'] === 1) {
      const plugins = Array.isArray(obj['plugins']) ? obj['plugins'] : [];
      return {
        ...obj,
        version: 2,
        plugins: plugins.map((entry: unknown) => {
          if (typeof entry === 'object' && entry !== null && !('origin' in entry)) {
            return { ...entry, origin: 'imported' };
          }
          return entry;
        }),
      };
    }

    return raw;
  },
  z
    .object({
      version: z.literal(2),
      plugins: z.array(metaEntryV2Schema).default([]),
    })
    .passthrough(),
);

export type MetaFile = z.output<typeof metaFileSchema>;
export type MetaEntry = z.output<typeof metaEntryV2Schema>;
