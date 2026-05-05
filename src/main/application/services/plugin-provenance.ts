import { join } from 'node:path';
import type { PluginId } from '../../domain/plugin-id.js';
import type { PluginCachePort } from '../ports/plugin-cache-port.js';
import type { FileSystemPort } from '../ports/filesystem-port.js';
import type { Scope } from '../ports/scope.js';

export interface ProvenanceKey {
  type: 'skill' | 'agent' | 'command';
  name: string;
}

export type ProvenanceMap = Map<string, PluginId>;

export function provenanceKey(key: ProvenanceKey): string {
  return `${key.type}/${key.name}`;
}

export interface PluginProvenanceDeps {
  cache: PluginCachePort;
  fs: FileSystemPort;
}

/**
 * Computes provenance — a map from {type/name} to PluginId — by reading the
 * plugin meta file and scanning each installed plugin's skills/, agents/, and
 * commands/ subdirectories. Customizations shipped by a plugin are read-only
 * from the app's perspective; the plugin lifecycle owns their files.
 */
export class PluginProvenanceService {
  constructor(private readonly deps?: PluginProvenanceDeps) {}

  async forScope(scope: Scope): Promise<ProvenanceMap> {
    const map: ProvenanceMap = new Map();
    if (!this.deps) return map;
    const { cache, fs } = this.deps;

    let plugins: ReadonlyArray<{ id: string }> = [];
    try {
      const meta = await cache.readMeta(scope);
      plugins = meta.plugins;
    } catch {
      return map;
    }

    for (const entry of plugins) {
      const pid = entry.id as PluginId;
      const dir = cache.pluginDir(scope, pid);
      await this.scanSkills(map, fs, dir, pid);
      await this.scanAgents(map, fs, dir, pid);
      await this.scanCommands(map, fs, dir, pid);
    }

    return map;
  }

  private async scanSkills(
    map: ProvenanceMap,
    fs: FileSystemPort,
    pluginDir: string,
    pid: PluginId,
  ): Promise<void> {
    const skillsDir = join(pluginDir, 'skills');
    try {
      if (!(await fs.pathExists(skillsDir))) return;
      const names = await fs.readdir(skillsDir);
      for (const name of names) {
        if (name.startsWith('.')) continue;
        map.set(provenanceKey({ type: 'skill', name }), pid);
      }
    } catch {
      // swallow — plugin dir may have been removed since meta was written
    }
  }

  private async scanAgents(
    map: ProvenanceMap,
    fs: FileSystemPort,
    pluginDir: string,
    pid: PluginId,
  ): Promise<void> {
    const agentsDir = join(pluginDir, 'agents');
    try {
      if (!(await fs.pathExists(agentsDir))) return;
      const entries = await fs.readdir(agentsDir);
      for (const entry of entries) {
        if (entry.startsWith('.') || !entry.endsWith('.md')) continue;
        const name = entry.replace(/\.md$/, '');
        map.set(provenanceKey({ type: 'agent', name }), pid);
      }
    } catch {
      // swallow
    }
  }

  private async scanCommands(
    map: ProvenanceMap,
    fs: FileSystemPort,
    pluginDir: string,
    pid: PluginId,
  ): Promise<void> {
    const commandsDir = join(pluginDir, 'commands');
    try {
      if (!(await fs.pathExists(commandsDir))) return;
      const entries = await fs.readdir(commandsDir);
      for (const entry of entries) {
        if (entry.startsWith('.') || !entry.endsWith('.md')) continue;
        const name = entry.replace(/\.md$/, '');
        map.set(provenanceKey({ type: 'command', name }), pid);
      }
    } catch {
      // swallow
    }
  }
}
