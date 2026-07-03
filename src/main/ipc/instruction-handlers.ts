import type { IpcHandlers } from './dispatcher.js';
import type { InstructionService } from '../application/services/instruction-service.js';
import type { Instruction } from '../../shared/entity.js';
import { asObject, asString } from './_validators.js';

export function buildInstructionHandlers(service: InstructionService): IpcHandlers {
  return {
    'instruction.get': async (params) => {
      const raw = asObject(params, 'instruction.get');
      return service.get(asString(raw['id'], 'id'));
    },
    'instruction.save': async (params) => {
      const raw = asObject(params, 'instruction.save');
      const instruction = asObject(raw['instruction'], 'instruction') as unknown as Instruction;
      const isCreate = typeof raw['isCreate'] === 'boolean' ? raw['isCreate'] : undefined;
      return service.save({ instruction, ...(isCreate !== undefined ? { isCreate } : {}) });
    },
  };
}
