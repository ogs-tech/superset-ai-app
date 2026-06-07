import { join } from 'node:path';
import type { PluginProvenanceService } from './plugin-provenance.js';
import type { PluginCachePort } from '../ports/plugin-cache-port.js';
import type { FileSystemPort } from '../ports/filesystem-port.js';
import type { Scope } from '../ports/scope.js';
import type { PluginId } from '../../domain/plugin-id.js';
import type { PluginProvenance } from '../../domain/customization-source.js';
import type { ProvenanceKey, PluginEntityRef } from './plugin-provenance.js';
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
    provenance: PluginProvenance;
  }) => TEntity;
}

/**
 * Reads every plugin-provided entity of one type for a scope, across all tiers
 * (workspace-managed + claude-code). Each entity is read from the dir resolved
 * by the provenance scan, so the source registry is transparent here. Files
 * that are unreadable or unparseable are skipped silently.
 */
export async function collectPluginEntities<TEntity>(
  deps: PluginEntityDeps,
  spec: PluginEntitySpec<TEntity>,
  scope: Scope,
): Promise<TEntity[]> {
  const { provenance, fs } = deps;
  // keyPrefix is always one of 'skill/' | 'agent/' | 'command/' (set by the
  // three typed services); an unknown prefix simply matches no refs.
  const type = spec.keyPrefix.replace(/\/$/, '') as PluginEntityRef['type'];
  const refs = await provenance.scan(scope);
  const out: TEntity[] = [];
  for (const ref of refs) {
    if (ref.type !== type) continue;
    const file = join(ref.dir, spec.relPath(ref.name));
    try {
      const raw = await fs.readFile(file);
      const { frontmatter, body } = parseMarkdown(raw);
      out.push(
        spec.build({
          name: ref.name,
          frontmatter,
          body,
          pluginId: ref.pluginId,
          provenance: ref.provenance,
        }),
      );
    } catch {
      // A single plugin entity that is unreadable, unparseable, or rejected by
      // build() is skipped silently — one bad file must not break the whole
      // read-only list (plugin files are owned by their plugin's lifecycle).
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
