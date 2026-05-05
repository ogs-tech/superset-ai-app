import type { GlobalInstruction } from '../schemas/global-instruction.js';
import type { GlobalInstructionId } from '../../domain/global-instruction-id.js';

export interface GlobalInstructionRepository {
  get(query: { id: GlobalInstructionId }): Promise<GlobalInstruction>;
  save(command: { globalInstruction: GlobalInstruction }): Promise<GlobalInstruction>;
  exists(query: { id: GlobalInstructionId }): Promise<boolean>;
}
