import type { CustomizationRepository } from '../../application/ports/customization-repository.js';
import type { SkillRepository } from '../../application/ports/skill-repository.js';
import type { Skill } from '../../application/schemas/skill.js';
import type { SkillFrontmatter } from '../../application/schemas/skill.js';
import { skillId, type SkillId } from '../../domain/skill-id.js';
import { WORKSPACE_SOURCE } from '../../domain/customization-source.js';
import { formatCustomizationId } from '../../domain/customization-id.js';

function toSkill(c: { id: string; frontmatter: unknown; body: string }): Skill {
  const fm = c.frontmatter as SkillFrontmatter;
  return {
    id: skillId(fm.name),
    frontmatter: fm,
    source: WORKSPACE_SOURCE,
    body: c.body,
  };
}

export class FsSkillRepository implements SkillRepository {
  constructor(private readonly base: CustomizationRepository) {}

  async list(): Promise<Skill[]> {
    const items = await this.base.list({ type: 'skill' });
    return items.map(toSkill);
  }

  async get(query: { id: SkillId }): Promise<Skill> {
    const c = await this.base.get({ id: formatCustomizationId('skill', query.id) });
    return toSkill(c);
  }

  async save(command: { skill: Skill }): Promise<Skill> {
    const saved = await this.base.save({
      customization: {
        id: formatCustomizationId('skill', command.skill.id),
        frontmatter: command.skill.frontmatter as never,
        body: command.skill.body,
      },
    });
    return toSkill(saved);
  }

  async delete(command: { id: SkillId }): Promise<void> {
    await this.base.delete({ id: formatCustomizationId('skill', command.id) });
  }

  async exists(query: { id: SkillId }): Promise<boolean> {
    return this.base.exists({ id: formatCustomizationId('skill', query.id) });
  }
}
