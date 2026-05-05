import type { IpcHandlers } from './dispatcher.js';
import type { GlobalInstructionService } from '../application/services/global-instruction-service.js';
import type { GlobalInstruction } from '../application/schemas/global-instruction.js';
import { globalInstructionId } from '../domain/global-instruction-id.js';
import { asObject, asString } from './_validators.js';

export function buildGlobalInstructionHandlers(
  service: GlobalInstructionService,
): IpcHandlers {
  return {
    'global-instruction.get': async (params) => {
      const raw = asObject(params, 'global-instruction.get');
      return service.get(globalInstructionId(asString(raw['id'], 'id')));
    },

    'global-instruction.save': async (params) => {
      const raw = asObject(params, 'global-instruction.save');
      const globalInstruction = asObject(
        raw['globalInstruction'],
        'globalInstruction',
      ) as unknown as GlobalInstruction;
      const isCreate = typeof raw['isCreate'] === 'boolean' ? raw['isCreate'] : undefined;
      return service.save({
        globalInstruction,
        ...(isCreate !== undefined ? { isCreate } : {}),
      });
    },
  };
}
