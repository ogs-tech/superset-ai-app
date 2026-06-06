import { join } from 'node:path';
import type { PluginProvenanceService } from './plugin-provenance.js';
import type { PluginCachePort } from '../ports/plugin-cache-port.js';
import type { FileSystemPort } from '../ports/filesystem-port.js';
import type { Scope } from '../ports/scope.js';
import type { PluginId } from '../../domain/plugin-id.js';
import type { ProvenanceKey } from './plugin-provenance.js';
import { parseMarkdown } from '../markdown/frontmatter.js';
import { OperationNotAllowedForOriginError } from '../../domain/plugin-errors.js';
import { provenanceKey } from './plugin-provenance.js';

export interface PluginEntityDeps {
  provenance: PluginProvenanceService;
  cache: PluginCachePort;
  fs: FileSystemPort;
}

export interface PluginEntitySpec<TEntity> {
  /** Provenance-key prefix selecting this entity type, e.g. 'skill/'. */
  keyPrefix: string;
  /** File path of the entity inside the plugin dir, relative to it. */
  relPath: (name: string) => string;
  /** Build the domain entity from the parsed plugin file. */
  build: (args: {
    name: string;
    frontmatter: unknown;
    body: string;
    pluginId: PluginId;
  }) => TEntity;
}

/**
 * Reads every plugin-provided entity of one type for a scope, parsing each
 * file and delegating shape construction to `spec.build`. Files that are
 * unreadable or unparseable are skipped silently (the plugin may be
 * mid-install or partial).
 */
export async function collectPluginEntities<TEntity>(
  deps: PluginEntityDeps,
  spec: PluginEntitySpec<TEntity>,
  scope: Scope,
): Promise<TEntity[]> {
  const { provenance, cache, fs } = deps;
  const map = await provenance.forScope(scope);
  const out: TEntity[] = [];
  for (const [key, pid] of map.entries()) {
    if (!key.startsWith(spec.keyPrefix)) continue;
    const name = key.slice(spec.keyPrefix.length);
    const file = join(cache.pluginDir(scope, pid), spec.relPath(name));
    try {
      const raw = await fs.readFile(file);
      const { frontmatter, body } = parseMarkdown(raw);
      out.push(spec.build({ name, frontmatter, body, pluginId: pid }));
    } catch {
      // Plugin entity file unreadable or unparseable — skip silently.
    }
  }
  return out;
}

/**
 * Throws OperationNotAllowedForOriginError if a workspace entity of this
 * type/name is actually provided (shadowed) by an installed plugin, making
 * save/delete illegal. No-op when provenance deps are not configured.
 */
export async function assertNotPluginSourced(
  deps: PluginEntityDeps | undefined,
  args: {
    type: ProvenanceKey['type'];
    operation: 'save' | 'delete';
    name: string;
    scope: Scope;
  },
): Promise<void> {
  if (!deps) return;
  const map = await deps.provenance.forScope(args.scope);
  const pid = map.get(provenanceKey({ type: args.type, name: args.name }));
  if (pid != null) {
    throw new OperationNotAllowedForOriginError(
      `Cannot ${args.operation} ${args.type} '${args.name}' provided by plugin '${pid}'`,
      { origin: 'plugin', operation: args.operation },
    );
  }
}
