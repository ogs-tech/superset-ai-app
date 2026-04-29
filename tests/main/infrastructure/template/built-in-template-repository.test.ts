import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { BuiltInTemplateRepository } from '../../../../src/main/infrastructure/template/built-in-template-repository.js';

const TEMPLATES_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  'src',
  'main',
  'templates',
);

describe('BuiltInTemplateRepository.list', () => {
  it('returns ≥1 skill template with frontmatter.type === skill', async () => {
    const repo = new BuiltInTemplateRepository(TEMPLATES_DIR);
    const list = await repo.list({ type: 'skill' });
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list[0]!.frontmatter.type).toBe('skill');
  });

  it('returns ≥1 reference template with frontmatter.type === reference', async () => {
    const repo = new BuiltInTemplateRepository(TEMPLATES_DIR);
    const list = await repo.list({ type: 'reference' });
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list[0]!.frontmatter.type).toBe('reference');
  });

  it('returns ≥1 agent template with frontmatter.type === agent', async () => {
    const repo = new BuiltInTemplateRepository(TEMPLATES_DIR);
    const list = await repo.list({ type: 'agent' });
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list[0]!.frontmatter.type).toBe('agent');
  });

  it('all built-in templates default to scopes: ["personal"]', async () => {
    const repo = new BuiltInTemplateRepository(TEMPLATES_DIR);
    for (const type of ['skill', 'reference', 'agent'] as const) {
      const list = await repo.list({ type });
      expect(list[0]!.frontmatter.scopes).toEqual(['personal']);
    }
  });

  it('parses body separately from frontmatter', async () => {
    const repo = new BuiltInTemplateRepository(TEMPLATES_DIR);
    const list = await repo.list({ type: 'skill' });
    expect(list[0]!.body).toContain('# new-skill');
    expect(list[0]!.body).not.toContain('---');
  });
});
