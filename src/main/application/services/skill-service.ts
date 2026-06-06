import { join } from 'node:path';
import type { CustomizationService } from './customization-service.js';
import type { PluginProvenanceService } from './plugin-provenance.js';
import type { Skill, SkillFrontmatter } from '../schemas/skill.js';
import type { SkillId } from '../../domain/skill-id.js';
import type { SyncResult } from '../../../shared/customization.js';
import type { PluginCachePort } from '../ports/plugin-cache-port.js';
import type { FileSystemPort } from '../ports/filesystem-port.js';
import type { Scope } from '../ports/scope.js';
import { skillId } from '../../domain/skill-id.js';
import { WORKSPACE_SOURCE, pluginSource } from '../../domain/customization-source.js';
import { formatCustomizationId } from '../../domain/customization-id.js';
import { parseMarkdown } from '../markdown/frontmatter.js';
import { OperationNotAllowedForOriginError } from '../../domain/plugin-errors.js';
import { provenanceKey } from './plugin-provenance.js';

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

export interface PluginProvenanceDepsForSkills {
  provenance: PluginProvenanceService;
  cache: PluginCachePort;
  fs: FileSystemPort;
}

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
    const { provenance, cache, fs } = this.pluginDeps;
    const map = await provenance.forScope(scope);
    const out: Skill[] = [];
    for (const [key, pid] of map.entries()) {
      if (!key.startsWith('skill/')) continue;
      const name = key.slice('skill/'.length);
      const file = join(cache.pluginDir(scope, pid), 'skills', name, 'SKILL.md');
      try {
        const raw = await fs.readFile(file);
        const { frontmatter, body } = parseMarkdown<SkillFrontmatter>(raw);
        out.push({
          id: skillId(name),
          frontmatter,
          source: pluginSource(pid),
          body,
        });
      } catch {
        // Plugin skill file unreadable — skip silently.
      }
    }
    return out;
  }


  async get(id: SkillId): Promise<Skill> {
    const c = await this.base.get({ id: formatCustomizationId('skill', id) });
    return toSkill(c);
  }

  async save(input: {
    skill: Skill;
    isCreate?: boolean;
    scope?: Scope;
  }): Promise<SaveSkillResult> {
    if (input.skill.source.kind === 'plugin') {
      throw new OperationNotAllowedForOriginError(
        `Cannot save a skill provided by plugin '${input.skill.source.pluginId}'`,
        { origin: 'plugin', operation: 'save' },
      );
    }
    await this.assertNotPluginSourced('save', input.skill.id, input.scope ?? 'personal');
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

  async delete(input: {
    id: SkillId;
    removeSymlinks: boolean;
    scope?: Scope;
  }): Promise<{
    ok: true;
    syncReport?: SyncResult[];
  }> {
    await this.assertNotPluginSourced('delete', input.id, input.scope ?? 'personal');
    return this.base.delete({
      id: formatCustomizationId('skill', input.id),
      removeSymlinks: input.removeSymlinks,
    });
  }

  private async assertNotPluginSourced(
    operation: 'save' | 'delete',
    id: SkillId,
    scope: Scope,
  ): Promise<void> {
    if (!this.pluginDeps) return;
    const map = await this.pluginDeps.provenance.forScope(scope);
    const pid = map.get(provenanceKey({ type: 'skill', name: id }));
    if (pid != null) {
      throw new OperationNotAllowedForOriginError(
        `Cannot ${operation} skill '${id}' provided by plugin '${pid}'`,
        { origin: 'plugin', operation },
      );
    }
  }
}
