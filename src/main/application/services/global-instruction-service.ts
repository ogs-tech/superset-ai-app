import type { CustomizationService } from './customization-service.js';
import type {
  GlobalInstruction,
  GlobalInstructionFrontmatter,
} from '../schemas/global-instruction.js';
import type { GlobalInstructionId } from '../../domain/global-instruction-id.js';
import type { SyncResult } from '../../../shared/customization.js';
import { globalInstructionId } from '../../domain/global-instruction-id.js';
import { WORKSPACE_SOURCE } from '../../domain/customization-source.js';
import { formatCustomizationId } from '../../domain/customization-id.js';

export interface SaveGlobalInstructionResult {
  globalInstruction: GlobalInstruction;
  syncReport: SyncResult[];
}

function toGlobalInstruction(c: {
  id: string;
  frontmatter: unknown;
  body: string;
}): GlobalInstruction {
  const fm = c.frontmatter as GlobalInstructionFrontmatter;
  return {
    id: globalInstructionId(fm.name),
    frontmatter: fm,
    source: WORKSPACE_SOURCE,
    body: c.body,
  };
}

export class GlobalInstructionService {
  constructor(private readonly base: CustomizationService) {}

  async get(id: GlobalInstructionId): Promise<GlobalInstruction> {
    const c = await this.base.get({ id: formatCustomizationId('global-instruction', id) });
    return toGlobalInstruction(c);
  }

  async save(input: {
    globalInstruction: GlobalInstruction;
    isCreate?: boolean;
  }): Promise<SaveGlobalInstructionResult> {
    const result = await this.base.save({
      customization: {
        id: formatCustomizationId('global-instruction', input.globalInstruction.id),
        frontmatter: input.globalInstruction.frontmatter as never,
        body: input.globalInstruction.body,
      },
      ...(input.isCreate !== undefined ? { isCreate: input.isCreate } : {}),
    });
    return {
      globalInstruction: toGlobalInstruction(result.customization),
      syncReport: result.syncReport,
    };
  }
}
