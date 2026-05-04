import { z } from 'zod';
import { pluginId } from '../../domain/plugin-id.js';
import { semVer } from '../../domain/semver.js';
import type { PluginManifest } from '../../domain/plugin-manifest.js';

// Use .passthrough() so unknown fields don't cause validation failure
export const pluginManifestSchema = z
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
        hooks: z.boolean().default(false),
        mcp: z.boolean().default(false),
        lsp: z.boolean().default(false),
      })
      .default({
        skills: [],
        agents: [],
        commands: [],
        hooks: false,
        mcp: false,
        lsp: false,
      }),
  })
  .passthrough();

export type PluginManifestInput = z.input<typeof pluginManifestSchema>;
export type PluginManifestOutput = z.output<typeof pluginManifestSchema>;
