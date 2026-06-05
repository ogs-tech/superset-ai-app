import type { CustomizationRepository } from '../../application/ports/customization-repository.js';
import type { GlobalInstructionRepository } from '../../application/ports/global-instruction-repository.js';
import type {
  GlobalInstruction,
  GlobalInstructionFrontmatter,
} from '../../application/schemas/global-instruction.js';
import {
  globalInstructionId,
  type GlobalInstructionId,
} from '../../domain/global-instruction-id.js';
import { WORKSPACE_SOURCE } from '../../domain/customization-source.js';
import { formatCustomizationId } from '../../domain/customization-id.js';

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

export class FsGlobalInstructionRepository implements GlobalInstructionRepository {
  constructor(private readonly base: CustomizationRepository) {}

  async get(query: { id: GlobalInstructionId }): Promise<GlobalInstruction> {
    const c = await this.base.get({ id: formatCustomizationId('global-instruction', query.id) });
    return toGlobalInstruction(c);
  }

  async save(command: { globalInstruction: GlobalInstruction }): Promise<GlobalInstruction> {
    const saved = await this.base.save({
      customization: {
        id: formatCustomizationId('global-instruction', command.globalInstruction.id),
        frontmatter: command.globalInstruction.frontmatter as never,
        body: command.globalInstruction.body,
      },
    });
    return toGlobalInstruction(saved);
  }

  async exists(query: { id: GlobalInstructionId }): Promise<boolean> {
    return this.base.exists({ id: formatCustomizationId('global-instruction', query.id) });
  }
}
