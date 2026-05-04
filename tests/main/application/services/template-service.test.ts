import { describe, expect, it } from 'vitest';
import { TemplateService } from '../../../../src/main/application/services/template-service.js';
import type {
  TemplateListQuery,
  TemplateRepository,
} from '../../../../src/main/application/ports/template-repository.js';
import type { ArtifactType, Template } from '../../../../src/shared/artifact.js';

const fixture = (type: ArtifactType, name: string): Template => ({
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
});
