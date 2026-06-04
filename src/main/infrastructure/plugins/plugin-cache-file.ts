import fs from 'node:fs/promises';
import path from 'node:path';
import type { PluginCachePort } from '../../application/ports/plugin-cache-port.js';
import type { Scope } from '../../application/ports/scope.js';
import type { PluginId } from '../../domain/plugin-id.js';
import type { PluginManifest } from '../../domain/plugin-manifest.js';
import type { MetaFile } from '../../application/schemas/meta-file.schema.js';
import { metaFileSchema } from '../../application/schemas/meta-file.schema.js';

export class PluginCacheFile implements PluginCachePort {
  constructor(
    private readonly config: {
      // Returns the workspace/plugins/ directory for the given scope
      pluginsDir(scope: Scope): string;
      // Returns the Claude cache dir: ~/.claude/plugins/cache/local/
      cacheDir(scope: Scope): string;
    },
  ) {}

  async readMeta(scope: Scope): Promise<MetaFile> {
    const metaPath = path.join(this.config.pluginsDir(scope), '_meta.json');
    try {
      const raw = await fs.readFile(metaPath, 'utf8');
      const json = JSON.parse(raw) as unknown;
      return metaFileSchema.parse(json);
    } catch (err) {
      if (isNotFound(err)) {
        // Return default v2 empty meta
        return metaFileSchema.parse({ version: 2, plugins: [] });
      }
      throw err;
    }
  }

  async writeMeta(scope: Scope, meta: MetaFile): Promise<void> {
    const pluginsDir = this.config.pluginsDir(scope);
    const metaPath = path.join(pluginsDir, '_meta.json');
    await fs.mkdir(path.dirname(metaPath), { recursive: true });
    // Atomic write
    const tmpPath = metaPath + '.tmp';
    await fs.writeFile(tmpPath, JSON.stringify(meta, null, 2), 'utf8');
    await fs.rename(tmpPath, metaPath);

    // Sidecar: keep the Claude Code marketplace.json in sync with _meta.json so
    // that the directory registered as the `local` marketplace can
    // actually be loaded by Claude Code. _meta.json is the source of truth.
    await this.syncMarketplaceManifest(pluginsDir, meta);
  }

  private async syncMarketplaceManifest(pluginsDir: string, meta: MetaFile): Promise<void> {
    const marketplaceDir = path.join(pluginsDir, '.claude-plugin');
    const marketplacePath = path.join(marketplaceDir, 'marketplace.json');

    if (meta.plugins.length === 0) {
      await fs.rm(marketplacePath, { force: true });
      await fs.rmdir(marketplaceDir).catch(() => {});
      return;
    }

    const plugins = await Promise.all(
      meta.plugins.map(async (entry) => {
        const description = await readPluginDescription(path.join(pluginsDir, entry.id));
        return {
          name: entry.id,
          description: description ?? '',
          source: `./${entry.id}`,
        };
      }),
    );

    const manifest = {
      name: 'local',
      owner: { name: 'SDE-AI' },
      description: 'Plugins managed by SDE-AI',
      plugins,
    };

    await fs.mkdir(marketplaceDir, { recursive: true });
    const tmpPath = marketplacePath + '.tmp';
    await fs.writeFile(tmpPath, JSON.stringify(manifest, null, 2), 'utf8');
    await fs.rename(tmpPath, marketplacePath);
  }

  pluginDir(scope: Scope, id: PluginId): string {
    return path.join(this.config.pluginsDir(scope), id);
  }

  async movePluginDir(from: string, to: string): Promise<void> {
    // Fail if destination already exists
    try {
      await fs.access(to);
      throw new Error(`Cannot move plugin dir: destination already exists: ${to}`);
    } catch (err) {
      if (!isNotFound(err)) throw err;
    }
    await fs.mkdir(path.dirname(to), { recursive: true });
    await fs.rename(from, to);
  }

  async removePluginDir(scope: Scope, id: PluginId): Promise<void> {
    const dir = this.pluginDir(scope, id);
    await fs.rm(dir, { recursive: true, force: true });
  }

  async scaffoldOwnedPlugin(scope: Scope, id: PluginId, manifest: PluginManifest): Promise<void> {
    const dir = this.pluginDir(scope, id);

    // Fail if dir already exists
    try {
      await fs.access(dir);
      throw new Error(`Cannot scaffold plugin: directory already exists: ${dir}`);
    } catch (err) {
      if (!isNotFound(err)) throw err;
    }

    // Create directory structure
    await fs.mkdir(path.join(dir, '.claude-plugin'), { recursive: true });
    await fs.mkdir(path.join(dir, 'skills'), { recursive: true });
    await fs.mkdir(path.join(dir, 'agents'), { recursive: true });
    await fs.mkdir(path.join(dir, 'commands'), { recursive: true });

    // Write plugin.json — Claude Code's official schema requires `name` (only
    // required field). `version`/`description` are optional. Components like
    // skills/agents/commands are auto-discovered from default folders, so we
    // don't emit an `artifacts` field (not part of the official schema).
    const manifestJson = {
      name: manifest.id,
      version: manifest.version,
      ...(manifest.description && { description: manifest.description }),
    };
    await fs.writeFile(
      path.join(dir, '.claude-plugin', 'plugin.json'),
      JSON.stringify(manifestJson, null, 2),
      'utf8',
    );
  }
}

function isNotFound(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'ENOENT'
  );
}

async function readPluginDescription(pluginDir: string): Promise<string | undefined> {
  try {
    const raw = await fs.readFile(path.join(pluginDir, '.claude-plugin', 'plugin.json'), 'utf8');
    const json = JSON.parse(raw) as { description?: unknown };
    return typeof json.description === 'string' ? json.description : undefined;
  } catch {
    return undefined;
  }
}
