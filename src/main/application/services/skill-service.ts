import type { CustomizationService } from './customization-service.js';
import type { Skill, SkillFrontmatter } from '../schemas/skill.js';
import type { SkillId } from '../../domain/skill-id.js';
import type { SyncResult } from '../../../shared/customization.js';
import type { Scope } from '../ports/scope.js';
import { skillId } from '../../domain/skill-id.js';
import { WORKSPACE_SOURCE, pluginSource } from '../../domain/customization-source.js';
import { formatCustomizationId } from '../../domain/customization-id.js';
import { OperationNotAllowedForOriginError } from '../../domain/plugin-errors.js';
import {
  collectPluginEntities,
  assertNotPluginSourced,
  type PluginEntityDeps,
} from './customization-plugin-helpers.js';

export interface SaveSkillResult {
  skill: Skill;
  syncReport: SyncResult[];
}

function toSkill(c: { id: string; frontmatter: unknown; body: string }): Skill {
  const fm = c.frontmatter as SkillFrontmatter;
  return {
    id: skillId(fm.name),
    frontmatter: fm,
    source: WORKSPACE_SOURCE,
    body: c.body,
  };
}

export type PluginProvenanceDepsForSkills = PluginEntityDeps;

export class SkillService {
  constructor(
    private readonly base: CustomizationService,
    private readonly pluginDeps?: PluginProvenanceDepsForSkills,
  ) {}

  async list(scope: Scope = 'personal'): Promise<Skill[]> {
    const workspace = (await this.base.list({ type: 'skill' })).map(toSkill);
    if (!this.pluginDeps) return workspace;

    const pluginSkills = await this.collectPluginSkills(scope);
    const workspaceIds = new Set(workspace.map((s) => s.id));
    return [...workspace, ...pluginSkills.filter((s) => !workspaceIds.has(s.id))];
  }

  private async collectPluginSkills(scope: Scope): Promise<Skill[]> {
    if (!this.pluginDeps) return [];
    return collectPluginEntities(
      this.pluginDeps,
      {
        keyPrefix: 'skill/',
        relPath: (name) => `skills/${name}/SKILL.md`,
        build: ({ name, frontmatter, body, pluginId, provenance }) => ({
          id: skillId(name),
          frontmatter: frontmatter as SkillFrontmatter,
          source: pluginSource(pluginId, provenance),
          body,
        }),
      },
      scope,
    );
  }

  async get(id: SkillId): Promise<Skill> {
    const c = await this.base.get({ id: formatCustomizationId('skill', id) });
    return toSkill(c);
  }

  async save(input: { skill: Skill; isCreate?: boolean; scope?: Scope }): Promise<SaveSkillResult> {
    if (input.skill.source.kind === 'plugin') {
      throw new OperationNotAllowedForOriginError(
        `Cannot save a skill provided by plugin '${input.skill.source.pluginId}'`,
        { origin: 'plugin', operation: 'save' },
      );
    }
    await assertNotPluginSourced(this.pluginDeps, {
      type: 'skill',
      operation: 'save',
      name: input.skill.id,
      scope: input.scope ?? 'personal',
    });
    const result = await this.base.save({
      customization: {
        id: formatCustomizationId('skill', input.skill.id),
        frontmatter: input.skill.frontmatter as never,
        body: input.skill.body,
      },
      ...(input.isCreate !== undefined ? { isCreate: input.isCreate } : {}),
    });
    return {
      skill: toSkill(result.customization),
      syncReport: result.syncReport,
    };
  }

  async delete(input: { id: SkillId; removeSymlinks: boolean; scope?: Scope }): Promise<{
    ok: true;
    syncReport?: SyncResult[];
  }> {
    await assertNotPluginSourced(this.pluginDeps, {
      type: 'skill',
      operation: 'delete',
      name: input.id,
      scope: input.scope ?? 'personal',
    });
    return this.base.delete({
      id: formatCustomizationId('skill', input.id),
      removeSymlinks: input.removeSymlinks,
    });
  }
}
