import type { IpcHandlers } from './dispatcher.js';
import type { CommandService } from '../application/services/command-service.js';
import type { Command } from '../application/schemas/command.js';
import type { Scope } from '../application/ports/scope.js';
import { commandId } from '../domain/command-id.js';
import { asBoolean, asObject, asScope, asString, optParams } from './_validators.js';

export function buildCommandHandlers(service: CommandService): IpcHandlers {
  return {
    'command.list': async (params) => {
      const raw = optParams(params, 'command.list');
      const scope: Scope = raw['scope'] !== undefined ? asScope(raw['scope']) : 'personal';
      return service.list(scope);
    },

    'command.get': async (params) => {
      const raw = asObject(params, 'command.get');
      return service.get(commandId(asString(raw['id'], 'id')));
    },

    'command.save': async (params) => {
      const raw = asObject(params, 'command.save');
      const command = asObject(raw['command'], 'command') as unknown as Command;
      const isCreate = typeof raw['isCreate'] === 'boolean' ? raw['isCreate'] : undefined;
      return service.save({ command, ...(isCreate !== undefined ? { isCreate } : {}) });
    },

    'command.delete': async (params) => {
      const raw = asObject(params, 'command.delete');
      return service.delete({
        id: commandId(asString(raw['id'], 'id')),
        removeSymlinks: asBoolean(raw['removeSymlinks'], 'removeSymlinks'),
      });
    },
  };
}
