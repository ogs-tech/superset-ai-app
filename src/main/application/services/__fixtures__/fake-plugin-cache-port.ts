import type { PluginCachePort } from '../../ports/plugin-cache-port.js';
import type { PluginId } from '../../../domain/plugin-id.js';
import type { PluginManifest } from '../../../domain/plugin-manifest.js';
import type { MetaFile } from '../../schemas/meta-file.schema.js';
import type { Scope } from '../../ports/scope.js';

export class FakePluginCachePort implements PluginCachePort {
  private metas: Map<string, MetaFile> = new Map();
  private dirs: Set<string> = new Set();
  private scaffolded: Map<string, PluginManifest> = new Map();

  seedMeta(scope: Scope, meta: MetaFile): void {
    this.metas.set(scope, meta);
  }

  getMeta(scope: Scope): MetaFile | undefined {
    return this.metas.get(scope);
  }

  getScaffolded(id: PluginId): PluginManifest | undefined {
    return this.scaffolded.get(id);
  }

  async readMeta(scope: Scope): Promise<MetaFile> {
    return this.metas.get(scope) ?? { version: 2, plugins: [] };
  }

  async writeMeta(scope: Scope, meta: MetaFile): Promise<void> {
    this.metas.set(scope, meta);
  }

  pluginDir(scope: Scope, id: PluginId): string {
    return `${scope}/plugins/${id}`;
  }

  async movePluginDir(from: string, to: string): Promise<void> {
    if (this.dirs.has(to)) {
      throw new Error(`Destination already exists: ${to}`);
    }
    this.dirs.delete(from);
    this.dirs.add(to);
  }

  async removePluginDir(scope: Scope, id: PluginId): Promise<void> {
    const dir = this.pluginDir(scope, id);
    this.dirs.delete(dir);
  }

  async scaffoldOwnedPlugin(scope: Scope, id: PluginId, manifest: PluginManifest): Promise<void> {
    const dir = this.pluginDir(scope, id);
    if (this.dirs.has(dir)) {
      throw new Error(`Plugin directory already exists: ${dir}`);
    }
    this.dirs.add(dir);
    this.scaffolded.set(id, manifest);
  }
}
