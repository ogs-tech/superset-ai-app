import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FsTemplateRepository } from '../../../../src/main/infrastructure/template/fs-template-repository.js';
import { parseMarkdown } from '../../../../src/main/infrastructure/markdown/frontmatter.js';
import { DomainError } from '../../../../src/main/domain/errors.js';
import type { Template, TemplateFrontmatter } from '../../../../src/shared/template.js';

const ISO = '2026-05-04T10:00:00.000Z';

const buildFrontmatter = (
  overrides: Partial<TemplateFrontmatter> = {},
): TemplateFrontmatter => ({
  name: 'new-skill',
  targetType: 'skill',
  description: 'a sample template',
  scopes: ['personal'],
  version: '0.1.0',
  createdAt: ISO,
  updatedAt: ISO,
  ...overrides,
});

const template = (name = 'new-skill', overrides: Partial<TemplateFrontmatter> = {}): Template => ({
  id: `template/${name}`,
  frontmatter: buildFrontmatter({ name, ...overrides }),
  body: `# ${name}\n`,
});

let workspace: string;

beforeEach(async () => {
  workspace = await mkdtemp(join(tmpdir(), 'sde-fs-template-'));
});

afterEach(async () => {
  await rm(workspace, { recursive: true, force: true });
});

describe('FsTemplateRepository.save', () => {
  it('writes <workspace>/templates/<slug>.md with parsed frontmatter', async () => {
    const repo = new FsTemplateRepository(workspace);
    await repo.save({ template: template('new-skill') });

    const target = join(workspace, 'templates', 'new-skill.md');
    const raw = await readFile(target, 'utf8');
    const { frontmatter, body } = parseMarkdown<TemplateFrontmatter>(raw);

    expect(frontmatter.name).toBe('new-skill');
    expect(frontmatter.targetType).toBe('skill');
    expect(frontmatter.createdAt).toBe(ISO);
    expect(body).toContain('# new-skill');
  });

  it('writes via tempfile + rename (no leftover files in templates/)', async () => {
    const repo = new FsTemplateRepository(workspace);
    await repo.save({ template: template('new-skill') });
    const entries = await fs.readdir(join(workspace, 'templates'));
    expect(entries).toEqual(['new-skill.md']);
  });
});

describe('FsTemplateRepository.delete', () => {
  it('removes the file', async () => {
    const repo = new FsTemplateRepository(workspace);
    await repo.save({ template: template('new-skill') });
    await repo.delete({ id: 'template/new-skill' });
    await expect(fs.stat(join(workspace, 'templates', 'new-skill.md'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('rejects with kind=not_found for non-existing id', async () => {
    const repo = new FsTemplateRepository(workspace);
    await expect(repo.delete({ id: 'template/missing' })).rejects.toBeInstanceOf(DomainError);
    await expect(repo.delete({ id: 'template/missing' })).rejects.toMatchObject({
      kind: 'not_found',
    });
  });
});

describe('FsTemplateRepository.list and get', () => {
  it('list({ targetType }) returns only templates whose frontmatter.targetType matches', async () => {
    const repo = new FsTemplateRepository(workspace);
    await repo.save({ template: template('new-skill', { targetType: 'skill' }) });
    await repo.save({ template: template('new-reference', { targetType: 'reference' }) });
    const skills = await repo.list({ targetType: 'skill' });
    expect(skills.map((t) => t.id)).toEqual(['template/new-skill']);
  });

  it('list() without filter returns all templates', async () => {
    const repo = new FsTemplateRepository(workspace);
    await repo.save({ template: template('new-skill', { targetType: 'skill' }) });
    await repo.save({ template: template('new-reference', { targetType: 'reference' }) });
    const all = await repo.list();
    expect(all.map((t) => t.id).sort()).toEqual(['template/new-reference', 'template/new-skill']);
  });

  it('list() returns [] when templates folder is missing', async () => {
    const repo = new FsTemplateRepository(workspace);
    expect(await repo.list()).toEqual([]);
  });

  it('list() ignores .DS_Store entries', async () => {
    const repo = new FsTemplateRepository(workspace);
    await repo.save({ template: template('new-skill') });
    await writeFile(join(workspace, 'templates', '.DS_Store'), 'binary', 'utf8');
    const all = await repo.list();
    expect(all.map((t) => t.id)).toEqual(['template/new-skill']);
  });

  it('get reads the file and returns parsed frontmatter and body', async () => {
    const repo = new FsTemplateRepository(workspace);
    await repo.save({ template: template('new-skill') });
    const result = await repo.get({ id: 'template/new-skill' });
    expect(result.id).toBe('template/new-skill');
    expect(result.frontmatter.name).toBe('new-skill');
    expect(result.body).toContain('# new-skill');
  });

  it('get rejects with kind=not_found for missing id', async () => {
    const repo = new FsTemplateRepository(workspace);
    await expect(repo.get({ id: 'template/missing' })).rejects.toMatchObject({
      kind: 'not_found',
    });
  });

  it('exists returns true after save and false after delete', async () => {
    const repo = new FsTemplateRepository(workspace);
    expect(await repo.exists({ id: 'template/x' })).toBe(false);
    await repo.save({ template: template('x') });
    expect(await repo.exists({ id: 'template/x' })).toBe(true);
    await repo.delete({ id: 'template/x' });
    expect(await repo.exists({ id: 'template/x' })).toBe(false);
  });
});
