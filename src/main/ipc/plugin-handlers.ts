import type { IpcHandlers } from './dispatcher.js';
import type { PluginService } from '../application/services/plugin-service.js';
import type { MarketplacePlugin } from '../domain/marketplace-manifest.js';
import { DomainError } from '../domain/errors.js';
import { pluginId } from '../domain/plugin-id.js';
import { semVer } from '../domain/semver.js';
import { parsePluginRef } from '../domain/plugin-ref.js';
import type { Scope } from '../application/ports/scope.js';

const SCOPES: readonly Scope[] = ['personal', 'project'];

const asString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new DomainError('validation', `Missing or invalid '${field}'`);
  }
  return value;
};

const asObject = (value: unknown, label: string): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new DomainError('validation', `Invalid '${label}' payload`);
  }
  return value as Record<string, unknown>;
};

const asBoolean = (value: unknown, field: string): boolean => {
  if (typeof value !== 'boolean') {
    throw new DomainError('validation', `Missing or invalid '${field}'`);
  }
  return value;
};

const asScope = (value: unknown): Scope => {
  if (typeof value !== 'string' || !(SCOPES as readonly string[]).includes(value)) {
    throw new DomainError(
      'validation',
      `Missing or invalid 'scope' (must be ${SCOPES.join(' | ')})`,
    );
  }
  return value as Scope;
};

export function buildPluginHandlers(pluginService: PluginService): IpcHandlers {
  return {
    'plugin.import': async (params) => {
      const raw = asObject(params, 'plugin.import');
      const url = asString(raw['url'], 'url');
      const scope = asScope(raw['scope']);
      const ref = raw['ref'] != null ? parsePluginRef(raw['ref']) : undefined;
      return pluginService.import({ url, scope, ...(ref != null ? { ref } : {}) });
    },

    'plugin.list': async (params) => {
      const raw = params !== null && params !== undefined ? asObject(params, 'plugin.list') : {};
      const scope = asScope(raw['scope']);
      return pluginService.list(scope);
    },

    'plugin.get': async (params) => {
      const raw = asObject(params, 'plugin.get');
      const id = pluginId(asString(raw['id'], 'id'));
      const scope = asScope(raw['scope']);
      return pluginService.get(id, scope);
    },

    'plugin.update': async (params) => {
      const raw = asObject(params, 'plugin.update');
      const id = pluginId(asString(raw['id'], 'id'));
      const scope = asScope(raw['scope']);
      return pluginService.update(id, scope);
    },

    'plugin.remove': async (params) => {
      const raw = asObject(params, 'plugin.remove');
      const id = pluginId(asString(raw['id'], 'id'));
      const scope = asScope(raw['scope']);
      await pluginService.remove(id, scope);
    },

    'plugin.toggle': async (params) => {
      const raw = asObject(params, 'plugin.toggle');
      const id = pluginId(asString(raw['id'], 'id'));
      const scope = asScope(raw['scope']);
      const enabled = asBoolean(raw['enabled'], 'enabled');
      await pluginService.toggle(id, scope, enabled);
    },

    'plugin.createOwned': async (params) => {
      const raw = asObject(params, 'plugin.createOwned');
      const id = pluginId(asString(raw['id'], 'id'));
      const version = semVer(asString(raw['version'], 'version'));
      const scope = asScope(raw['scope']);
      const description = typeof raw['description'] === 'string' ? raw['description'] : undefined;
      return pluginService.createOwned({
        id,
        version,
        scope,
        ...(description != null ? { description } : {}),
      });
    },

    'plugin.deleteOwned': async (params) => {
      const raw = asObject(params, 'plugin.deleteOwned');
      const id = pluginId(asString(raw['id'], 'id'));
      const scope = asScope(raw['scope']);
      await pluginService.deleteOwned(id, scope);
    },

    'marketplace.detect': async (params) => {
      const raw = asObject(params, 'marketplace.detect');
      const url = asString(raw['url'], 'url');
      return pluginService.detect(url);
    },

    'plugin.installFromMarketplace': async (params) => {
      const raw = asObject(params, 'plugin.installFromMarketplace');
      const plugin = raw['plugin'] as MarketplacePlugin;
      const scope = asScope(raw['scope']);
      const marketplaceId =
        typeof raw['marketplaceId'] === 'string' && raw['marketplaceId'].length > 0
          ? raw['marketplaceId']
          : undefined;
      return pluginService.importFromMarketplace(plugin, scope, marketplaceId);
    },

    'plugin.previewFromMarketplace': async (params) => {
      const raw = asObject(params, 'plugin.previewFromMarketplace');
      const plugin = raw['plugin'] as MarketplacePlugin;
      return pluginService.previewFromMarketplace(plugin);
    },

    'plugin.publish': async (params) => {
      const raw = asObject(params, 'plugin.publish');
      const id = pluginId(asString(raw['id'], 'id'));
      const scope = asScope(raw['scope']);
      const version = semVer(asString(raw['version'], 'version'));
      const repoName = typeof raw['repoName'] === 'string' ? raw['repoName'] : undefined;
      const visibility =
        raw['visibility'] === 'private' ? ('private' as const) : ('public' as const);
      const commitMessage =
        typeof raw['commitMessage'] === 'string' ? raw['commitMessage'] : undefined;
      return pluginService.publish({
        id,
        scope,
        version,
        ...(repoName != null ? { repoName } : {}),
        visibility,
        ...(commitMessage != null ? { commitMessage } : {}),
      });
    },
  };
}
