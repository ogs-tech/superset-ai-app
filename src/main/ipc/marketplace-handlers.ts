import type { IpcHandlers } from './dispatcher.js';
import type { MarketplaceService } from '../application/services/marketplace-service.js';
import { marketplaceId } from '../domain/marketplace-id.js';
import { asObject, asScope, asString } from './_validators.js';

export function buildMarketplaceHandlers(service: MarketplaceService): IpcHandlers {
  return {
    'marketplace.list': async (params) => {
      const raw = asObject(params, 'marketplace.list');
      const scope = asScope(raw['scope']);
      return service.list(scope);
    },

    'marketplace.get': async (params) => {
      const raw = asObject(params, 'marketplace.get');
      const scope = asScope(raw['scope']);
      const id = marketplaceId(asString(raw['id'], 'id'));
      return service.get(scope, id);
    },

    'marketplace.add': async (params) => {
      const raw = asObject(params, 'marketplace.add');
      const scope = asScope(raw['scope']);
      const id = marketplaceId(asString(raw['id'], 'id'));
      const sourceRaw = asObject(raw['source'], 'source');
      const path = asString(sourceRaw['path'], 'source.path');
      await service.add(scope, { id, source: { kind: 'directory', path } });
    },

    'marketplace.remove': async (params) => {
      const raw = asObject(params, 'marketplace.remove');
      const scope = asScope(raw['scope']);
      const id = marketplaceId(asString(raw['id'], 'id'));
      await service.remove(scope, id);
    },

    'marketplace.refresh': async (params) => {
      const raw = asObject(params, 'marketplace.refresh');
      const scope = asScope(raw['scope']);
      const id = marketplaceId(asString(raw['id'], 'id'));
      return service.refresh(scope, id);
    },
  };
}
