import type { IpcHandlers } from './dispatcher.js';
import type { ReferenceService } from '../application/services/reference-service.js';
import type { Reference } from '../application/schemas/reference.js';
import { referenceId } from '../domain/reference-id.js';
import { asBoolean, asObject, asString, optParams } from './_validators.js';

export function buildReferenceHandlers(service: ReferenceService): IpcHandlers {
  return {
    'reference.list': async (params) => {
      optParams(params, 'reference.list');
      return service.list();
    },

    'reference.get': async (params) => {
      const raw = asObject(params, 'reference.get');
      return service.get(referenceId(asString(raw['id'], 'id')));
    },

    'reference.save': async (params) => {
      const raw = asObject(params, 'reference.save');
      const reference = asObject(raw['reference'], 'reference') as unknown as Reference;
      const isCreate = typeof raw['isCreate'] === 'boolean' ? raw['isCreate'] : undefined;
      return service.save({ reference, ...(isCreate !== undefined ? { isCreate } : {}) });
    },

    'reference.delete': async (params) => {
      const raw = asObject(params, 'reference.delete');
      return service.delete({
        id: referenceId(asString(raw['id'], 'id')),
        removeSymlinks: asBoolean(raw['removeSymlinks'], 'removeSymlinks'),
      });
    },
  };
}
