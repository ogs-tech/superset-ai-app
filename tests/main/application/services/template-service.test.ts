import { describe, expect, it, beforeEach } from 'vitest';
import { TemplateService } from '../../../../src/main/application/services/template-service.js';
import type {
  TemplateDeleteCommand,
  TemplateExistsQuery,
  TemplateGetQuery,
  TemplateListQuery,
  TemplateRepository,
  TemplateSaveCommand,
} from '../../../../src/main/application/ports/template-repository.js';
import type { Template, TemplateFrontmatter, TemplateTargetType } from '../../../../src/shared/template.js';
import type { ClockPort } from '../../../../src/main/application/ports/clock-port.js';

const ISO = '2026-05-04T10:00:00.000Z';

const fixedClock: ClockPort = { now: () => new Date(ISO) };

const buildFrontmatter = (overrides: Partial<TemplateFrontmatter> = {}): TemplateFrontmatter => ({
  name: 'new-skill',
  targetType: 'skill',
  description: 'a sample',
  scopes: ['personal'],
  version: '0.1.0',
  createdAt: ISO,
  updatedAt: ISO,
  ...overrides,
});

const fixture = (
  targetType: TemplateTargetType,
  name: string,
  overrides: Partial<TemplateFrontmatter> = {},
): Template => ({
  id: `template/${name}`,
  frontmatter: buildFrontmatter({ name, targetType, ...overrides }),
  body: `# ${targetType}\n`,
});

class InMemoryTemplateRepository implements TemplateRepository {
  private store = new Map<string, Template>();

  constructor(initial: Template[] = []) {
    for (const t of initial) this.store.set(t.id, t);
  }

  list(query: TemplateListQuery = {}): Promise<Template[]> {
    const all = [...this.store.values()];
    if (query.targetType) {
      return Promise.resolve(all.filter((t) => t.frontmatter.targetType === query.targetType));
    }
    return Promise.resolve(all);
  }

  get(query: TemplateGetQuery): Promise<Template> {
    const t = this.store.get(query.id);
    if (!t) throw new Error(`not found: ${query.id}`);
    return Promise.resolve(t);
  }

  save(command: TemplateSaveCommand): Promise<Template> {
    this.store.set(command.template.id, command.template);
    return Promise.resolve(command.template);
  }

  delete(command: TemplateDeleteCommand): Promise<void> {
    this.store.delete(command.id);
    return Promise.resolve();
  }

  exists(query: TemplateExistsQuery): Promise<boolean> {
    return Promise.resolve(this.store.has(query.id));
  }
}

let repo: InMemoryTemplateRepository;
let service: TemplateService;

beforeEach(() => {
  repo = new InMemoryTemplateRepository();
  service = new TemplateService(repo, fixedClock);
});

describe('TemplateService.list', () => {
  it('returns all templates when no filter', async () => {
    repo = new InMemoryTemplateRepository([
      fixture('skill', 'new-skill'),
      fixture('reference', 'new-reference'),
    ]);
    service = new TemplateService(repo, fixedClock);
    const list = await service.list();
    expect(list).toHaveLength(2);
  });

  it('filters by targetType', async () => {
    repo = new InMemoryTemplateRepository([
      fixture('skill', 'a'),
      fixture('skill', 'b'),
      fixture('reference', 'c'),
    ]);
    service = new TemplateService(repo, fixedClock);
    const skills = await service.list({ targetType: 'skill' });
    expect(skills.map((t) => t.frontmatter.name).sort()).toEqual(['a', 'b']);
  });
});

describe('TemplateService.save', () => {
  it('creates a new template with stamped timestamps', async () => {
    const tpl: Template = {
      id: '',
      frontmatter: { ...buildFrontmatter({ name: 'fresh' }), createdAt: '', updatedAt: '' },
      body: '# fresh\n',
    };
    const saved = await service.save({ template: tpl, isCreate: true });
    expect(saved.id).toBe('template/fresh');
    expect(saved.frontmatter.createdAt).toBe(ISO);
    expect(saved.frontmatter.updatedAt).toBe(ISO);
  });

  it('rejects creating an existing template id', async () => {
    repo = new InMemoryTemplateRepository([fixture('skill', 'dup')]);
    service = new TemplateService(repo, fixedClock);
    await expect(
      service.save({
        template: { id: '', frontmatter: buildFrontmatter({ name: 'dup' }), body: '' },
        isCreate: true,
      }),
    ).rejects.toMatchObject({ kind: 'validation' });
  });

  it('preserves createdAt on update', async () => {
    const original: Template = fixture('skill', 'foo', { createdAt: '2026-01-01T00:00:00.000Z' });
    repo = new InMemoryTemplateRepository([original]);
    service = new TemplateService(repo, fixedClock);
    const updated: Template = {
      ...original,
      body: '# updated\n',
    };
    const saved = await service.save({ template: updated });
    expect(saved.frontmatter.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(saved.frontmatter.updatedAt).toBe(ISO);
  });
});

describe('TemplateService.delete', () => {
  it('removes the template', async () => {
    repo = new InMemoryTemplateRepository([fixture('skill', 'foo')]);
    service = new TemplateService(repo, fixedClock);
    await service.delete({ id: 'template/foo' });
    expect(await repo.exists({ id: 'template/foo' })).toBe(false);
  });
});
