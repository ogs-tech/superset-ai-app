import { z } from 'zod';
import { pluginId } from '../../domain/plugin-id.js';
import { semVer } from '../../domain/semver.js';

// Official marketplace plugins use { name, version?, ... } instead of { id, version, ... }.
// Preprocess normalises: if no `id`, fall back to `name`; if no `version`, default to '0.0.0'.
const normaliseManifest = (raw: unknown): unknown => {
  if (typeof raw !== 'object' || raw === null) return raw;
  const obj = raw as Record<string, unknown>;
  const id = obj['id'] ?? (typeof obj['name'] === 'string' ? obj['name'] : undefined);
  const version = obj['version'] ?? '0.0.0';
  return { ...obj, id, version };
};

const coreManifestSchema = z
  .object({
    id: z.string().transform((val, ctx) => {
      try {
        return pluginId(val);
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid plugin ID: ${val}`,
        });
        return z.NEVER;
      }
    }),
    version: z.string().transform((val, ctx) => {
      try {
        return semVer(val);
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid semver: ${val}`,
        });
        return z.NEVER;
      }
    }),
    description: z.string().optional(),
    artifacts: z
      .object({
        skills: z.array(z.string()).default([]),
        agents: z.array(z.string()).default([]),
        commands: z.array(z.string()).default([]),
        hooks: z
          .union([z.boolean(), z.number().int().nonnegative()])
          .transform((v) => (typeof v === 'boolean' ? (v ? 1 : 0) : v))
          .default(0),
        mcp: z.boolean().default(false),
        lsp: z.boolean().default(false),
      })
      .default({
        skills: [],
        agents: [],
        commands: [],
        hooks: 0,
        mcp: false,
        lsp: false,
      }),
  })
  .passthrough();

// Use .passthrough() so unknown fields don't cause validation failure
export const pluginManifestSchema = z.preprocess(normaliseManifest, coreManifestSchema);

export type PluginManifestInput = z.input<typeof pluginManifestSchema>;
export type PluginManifestOutput = z.output<typeof pluginManifestSchema>;
