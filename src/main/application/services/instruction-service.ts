// src/main/application/services/instruction-service.ts
import type { EntityService } from './entity-service.js';
import type { Instruction } from '../../../shared/entity.js';
import { entityUrn, WORKSPACE_SOURCE } from '../../../shared/entity.js';
import type { SyncResult } from '../../../shared/sync-result.js';
import { globalInstructionId } from '../../domain/global-instruction-id.js';

export interface SaveInstructionResult {
  instruction: Instruction;
  syncReport: SyncResult[];
}

export class InstructionService {
  constructor(private readonly base: EntityService) {}

  async get(name = 'default'): Promise<Instruction> {
    // globalInstructionId validates that the slug is the allowed singleton 'default'.
    const id = globalInstructionId(name);
    return (await this.base.get(entityUrn('instruction', id))) as Instruction;
  }

  async save(input: { instruction: Instruction; isCreate?: boolean }): Promise<SaveInstructionResult> {
    const result = await this.base.save({
      entity: { ...input.instruction, source: WORKSPACE_SOURCE },
      ...(input.isCreate !== undefined ? { isCreate: input.isCreate } : {}),
    });
    return { instruction: result.entity as Instruction, syncReport: result.syncReport };
  }
}
