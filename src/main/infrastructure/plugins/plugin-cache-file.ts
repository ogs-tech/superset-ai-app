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
      // Returns the Claude cache dir: ~/.claude/plugins/cache/skillforge-imports/
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
    const metaPath = path.join(this.config.pluginsDir(scope), '_meta.json');
    await fs.mkdir(path.dirname(metaPath), { recursive: true });
    // Atomic write
    const tmpPath = metaPath + '.tmp';
    await fs.writeFile(tmpPath, JSON.stringify(meta, null, 2), 'utf8');
    await fs.rename(tmpPath, metaPath);
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

    // Write plugin.json
    const manifestJson = {
      id: manifest.id,
      version: manifest.version,
      ...(manifest.description && { description: manifest.description }),
      artifacts: manifest.artifacts,
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
