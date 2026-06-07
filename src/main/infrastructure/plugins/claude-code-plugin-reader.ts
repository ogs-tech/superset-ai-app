import { z } from 'zod';
import type { FileSystemPort } from '../../application/ports/filesystem-port.js';
import type {
  ClaudeCodePluginDescriptor,
  ClaudeCodePluginRegistryPort,
} from '../../application/ports/claude-code-plugin-registry-port.js';
import { tryPluginId } from '../../domain/plugin-id.js';

const installSchema = z
  .object({
    scope: z.string(),
    installPath: z.string().min(1),
    version: z.string().optional(),
  })
  .passthrough();

const registrySchema = z
  .object({
    plugins: z.record(z.string(), z.array(installSchema)),
  })
  .passthrough();

/**
 * Reads Claude Code's `installed_plugins.json` registry and returns one
 * descriptor per `scope: "user"` install. Never throws on a missing or corrupt
 * registry — both yield an empty list so the entity lists never break.
 */
export class ClaudeCodePluginReader implements ClaudeCodePluginRegistryPort {
  constructor(
    private readonly deps: {
      registryPath: string;
      fs: Pick<FileSystemPort, 'readFile'>;
    },
  ) {}

  async list(): Promise<ClaudeCodePluginDescriptor[]> {
    let raw: string;
    try {
      raw = await this.deps.fs.readFile(this.deps.registryPath);
    } catch {
      return []; // Missing file — Claude Code not installed / no plugins.
    }

    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      console.warn('[ClaudeCodePluginReader] installed_plugins.json is not valid JSON; ignoring');
      return [];
    }

    const parsed = registrySchema.safeParse(json);
    if (!parsed.success) {
      console.warn('[ClaudeCodePluginReader] installed_plugins.json has an unexpected shape; ignoring');
      return [];
    }

    const out: ClaudeCodePluginDescriptor[] = [];
    for (const [key, installs] of Object.entries(parsed.data.plugins)) {
      const at = key.lastIndexOf('@');
      // Need a non-empty plugin name (at > 0) and a non-empty marketplace
      // (at is not the last char) — keys like "x@" or "@mp" are malformed.
      if (at <= 0 || at === key.length - 1) continue;
      const name = key.slice(0, at);
      const marketplace = key.slice(at + 1);
      const idResult = tryPluginId(name);
      if (!idResult.ok) continue; // Plugin name is not a valid PluginId.

      for (const install of installs) {
        if (install.scope !== 'user') continue;
        out.push({
          pluginId: idResult.value,
          marketplace,
          installPath: install.installPath,
          version: install.version ?? 'unknown',
          scope: 'user',
        });
      }
    }
    return out;
  }
}
