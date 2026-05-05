import type { PluginId } from '../../domain/plugin-id.js';
import type { PluginManifest } from '../../domain/plugin-manifest.js';
import type { MetaFile } from '../schemas/meta-file.schema.js';
import type { Scope } from './scope.js';

export interface PluginCachePort {
  readMeta(scope: Scope): Promise<MetaFile>;
  writeMeta(scope: Scope, meta: MetaFile): Promise<void>;
  pluginDir(scope: Scope, id: PluginId): string;
  movePluginDir(from: string, to: string): Promise<void>;
  removePluginDir(scope: Scope, id: PluginId): Promise<void>;
  scaffoldOwnedPlugin(scope: Scope, id: PluginId, manifest: PluginManifest): Promise<void>;
}
