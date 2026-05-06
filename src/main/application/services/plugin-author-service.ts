import type { PluginCachePort } from '../ports/plugin-cache-port.js';
import type { Scope } from '../ports/scope.js';
import type { PluginId } from '../../domain/plugin-id.js';
import type { SemVer } from '../../domain/semver.js';
import type { PluginManifest } from '../../domain/plugin-manifest.js';
import { OwnPluginIdCollisionError, OperationNotAllowedForOriginError } from '../../domain/plugin-errors.js';
import type { PluginSummary } from './plugin-installer.js';
import type { PluginOrigin } from '../../domain/plugin-origin.js';

/** Structural interface for the installer — allows fakes in tests. */
export interface PluginInstallerLike {
  install(input: {
    origin: PluginOrigin;
    id: PluginId;
    pluginDir: string;
    scope: Scope;
  }): Promise<PluginSummary>;
  uninstall(id: PluginId, scope: Scope): Promise<void>;
}

/** Structural interface for the manifest parser — allows fakes in tests. */
export interface PluginManifestParserLike {
  parse(pluginDir: string): Promise<PluginManifest>;
}

export class PluginAuthorService {
  constructor(
    private readonly deps: {
      cache: PluginCachePort;
      installer: PluginInstallerLike;
      parser: PluginManifestParserLike;
    },
  ) {}

  async create(input: {
    id: PluginId;
    version: SemVer;
    description?: string;
    scope: Scope;
  }): Promise<PluginSummary> {
    const { cache, installer, parser } = this.deps;
    const { id, version, description, scope } = input;

    // 1. Read _meta.json
    const meta = await cache.readMeta(scope);

    // 2. Check for id collision (any origin)
    const existing = meta.plugins.find((p) => p.id === id);
    if (existing != null) {
      throw new OwnPluginIdCollisionError(`Plugin id already exists: ${id}`, { id });
    }

    // 3. Scaffold the owned plugin directory with manifest
    const manifest = {
      id,
      version,
      ...(description != null && { description }),
      artifacts: {
        skills: [],
        agents: [],
        commands: [],
        hooks: 0 as const,
        mcp: false as const,
        lsp: false as const,
      },
    };
    await cache.scaffoldOwnedPlugin(scope, id, manifest);

    // 4. Sanity-check the scaffolded manifest
    const pluginDir = cache.pluginDir(scope, id);
    await parser.parse(pluginDir);

    // 5. Install (registers in settings + meta)
    const summary = await installer.install({ origin: 'owned', id, pluginDir, scope });

    return summary;
  }

  async delete(id: PluginId, scope: Scope): Promise<void> {
    const { cache, installer } = this.deps;

    // 1. Read _meta.json
    const meta = await cache.readMeta(scope);

    // 2. Find entry — if not found, silently return (idempotent delete)
    const entry = meta.plugins.find((p) => p.id === id);
    if (entry == null) {
      return;
    }

    // 3. Only owned plugins may be deleted via this method
    if (entry.origin !== 'owned') {
      throw new OperationNotAllowedForOriginError(
        'Cannot delete imported plugin with deleteOwned',
        { origin: entry.origin, operation: 'deleteOwned' },
      );
    }

    // 4. Delegate full teardown to installer
    await installer.uninstall(id, scope);
  }
}
