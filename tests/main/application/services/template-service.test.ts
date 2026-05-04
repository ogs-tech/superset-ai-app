import { describe, expect, it } from 'vitest';
import { TemplateService } from '../../../../src/main/application/services/template-service.js';
import { InMemoryArtifactRepository } from '../../../../src/main/infrastructure/artifact/in-memory-artifact-repository.js';
import type {
  TemplateListQuery,
  TemplateRepository,
} from '../../../../src/main/application/ports/template-repository.js';
import type { Artifact, Template, TemplateTargetType } from '../../../../src/shared/artifact.js';

const fixture = (type: TemplateTargetType, name: string): Template => ({
  id: `${type}/${name}`,
  type,
  name: `${type} ${name}`,
  description: `Template for ${type}`,
  frontmatter: { type },
  body: `# ${type}\n`,
});

class InMemoryTemplateRepository implements TemplateRepository {
  constructor(private readonly all: Template[]) {}
  list(query: TemplateListQuery): Promise<Template[]> {
    return Promise.resolve(this.all.filter((t) => t.type === query.type));
  }
}

describe('TemplateService.list', () => {
  it('returns ≥1 template for skill', async () => {
    const repo = new InMemoryTemplateRepository([fixture('skill', 'default')]);
    const service = new TemplateService(repo);
    const list = await service.list({ type: 'skill' });
    expect(list.length).toBeGreaterThanOrEqual(1);
  });

  it('returns ≥1 template for reference', async () => {
    const repo = new InMemoryTemplateRepository([fixture('reference', 'default')]);
    const service = new TemplateService(repo);
    const list = await service.list({ type: 'reference' });
    expect(list.length).toBeGreaterThanOrEqual(1);
  });

  it('returns ≥1 template for agent', async () => {
    const repo = new InMemoryTemplateRepository([fixture('agent', 'default')]);
    const service = new TemplateService(repo);
    const list = await service.list({ type: 'agent' });
    expect(list.length).toBeGreaterThanOrEqual(1);
  });

  it('each returned template carries frontmatter.type matching the filter', async () => {
    const repo = new InMemoryTemplateRepository([
      fixture('skill', 'a'),
      fixture('skill', 'b'),
      fixture('reference', 'c'),
    ]);
    const service = new TemplateService(repo);
    const skills = await service.list({ type: 'skill' });
    expect(skills.every((t) => t.frontmatter.type === 'skill')).toBe(true);
    expect(skills.length).toBe(2);
  });

  it('returns 1 unified global-instruction template', async () => {
    const repo = new InMemoryTemplateRepository([
      fixture('global-instruction', 'default'),
      fixture('skill', 'noise'),
    ]);
    const service = new TemplateService(repo);
    const list = await service.list({ type: 'global-instruction' });
    expect(list).toHaveLength(1);
    expect(list[0]!.id).toBe('global-instruction/default');
    expect(list[0]!.body.length).toBeGreaterThan(0);
  });

  it('merges user-managed template artifacts with built-ins, filtered by targetType', async () => {
    const builtIns = new InMemoryTemplateRepository([fixture('skill', 'default')]);
    const artifacts = new InMemoryArtifactRepository();
    const userSkillTemplate: Artifact = {
      id: 'template/my-skill-template',
      frontmatter: {
        name: 'my-skill-template',
        type: 'template',
        description: 'A custom skill template',
        scopes: ['personal'],
        version: '0.1.0',
        targetType: 'skill',
        createdAt: '2026-05-04T00:00:00.000Z',
        updatedAt: '2026-05-04T00:00:00.000Z',
      },
      body: '# my custom skill body',
    };
    const userAgentTemplate: Artifact = {
      id: 'template/agent-tpl',
      frontmatter: {
        name: 'agent-tpl',
        type: 'template',
        description: 'An agent template',
        scopes: ['personal'],
        version: '0.1.0',
        targetType: 'agent',
        createdAt: '2026-05-04T00:00:00.000Z',
        updatedAt: '2026-05-04T00:00:00.000Z',
      },
      body: '# agent body',
    };
    await artifacts.save({ artifact: userSkillTemplate });
    await artifacts.save({ artifact: userAgentTemplate });

    const service = new TemplateService(builtIns, artifacts);
    const skillTemplates = await service.list({ type: 'skill' });

    expect(skillTemplates.map((t) => t.name)).toEqual(['my-skill-template', 'skill default']);
    expect(skillTemplates[0]!.frontmatter.type).toBe('skill');
    expect(skillTemplates[0]!.body).toBe('# my custom skill body');
  });

  it('returns only built-ins when no artifact repository is provided', async () => {
    const builtIns = new InMemoryTemplateRepository([fixture('skill', 'default')]);
    const service = new TemplateService(builtIns);
    const list = await service.list({ type: 'skill' });
    expect(list).toHaveLength(1);
    expect(list[0]!.id).toBe('skill/default');
  });
});
