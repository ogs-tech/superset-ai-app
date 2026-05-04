import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { FsCustomizationRepository } from '../../../../src/main/infrastructure/customization/fs-customization-repository.js';
import { parseMarkdown } from '../../../../src/main/infrastructure/markdown/frontmatter.js';
import { DomainError } from '../../../../src/main/domain/errors.js';
import type { Customization, CustomizationFrontmatter } from '../../../../src/shared/customization.js';

const ISO = '2026-04-26T10:00:00.000Z';

const buildFrontmatter = (
  overrides: Partial<CustomizationFrontmatter> = {},
): CustomizationFrontmatter => ({
  name: 'foo',
  type: 'skill',
  description: 'a sample',
  scopes: ['personal'],
  version: '0.1.0',
  createdAt: ISO,
  updatedAt: ISO,
  ...overrides,
});

const skill = (name = 'foo'): Customization => ({
  id: `skill/${name}`,
  frontmatter: buildFrontmatter({ name, type: 'skill' }),
  body: '# Foo\n',
});

const reference = (name = 'bar'): Customization => ({
  id: `reference/${name}`,
  frontmatter: buildFrontmatter({ name, type: 'reference' }),
  body: '# Bar\n',
});

const agent = (name = 'baz'): Customization => ({
  id: `agent/${name}`,
  frontmatter: buildFrontmatter({ name, type: 'agent' }),
  body: '# Baz\n',
});

let workspace: string;

beforeEach(async () => {
  workspace = await mkdtemp(join(tmpdir(), 'sde-fs-customization-'));
});

afterEach(async () => {
  await rm(workspace, { recursive: true, force: true });
});

describe('FsCustomizationRepository.save — skill', () => {
  it('writes <workspace>/skills/<slug>/SKILL.md with parsed frontmatter and ISO-8601 UTC timestamps', async () => {
    const repo = new FsCustomizationRepository(workspace);
    await repo.save({ customization: skill('foo') });

    const target = join(workspace, 'skills', 'foo', 'SKILL.md');
    const raw = await readFile(target, 'utf8');
    const { frontmatter, body } = parseMarkdown<CustomizationFrontmatter>(raw);

    expect(frontmatter.name).toBe('foo');
    expect(frontmatter.type).toBe('skill');
    expect(frontmatter.createdAt).toBe(ISO);
    expect(frontmatter.updatedAt).toBe(ISO);
    expect(body).toContain('# Foo');
  });

  it('re-save preserves createdAt on disk', async () => {
    const repo = new FsCustomizationRepository(workspace);
    await repo.save({ customization: skill('foo') });

    const target = join(workspace, 'skills', 'foo', 'SKILL.md');
    const before = parseMarkdown<CustomizationFrontmatter>(await readFile(target, 'utf8'));
    const createdAt = before.frontmatter.createdAt;

    const updated = skill('foo');
    updated.frontmatter.updatedAt = '2026-04-26T12:00:00.000Z';
    updated.frontmatter.createdAt = createdAt;
    await repo.save({ customization: updated });

    const after = parseMarkdown<CustomizationFrontmatter>(await readFile(target, 'utf8'));
    expect(after.frontmatter.createdAt).toBe(createdAt);
    expect(after.frontmatter.updatedAt).toBe('2026-04-26T12:00:00.000Z');
  });
});

describe('FsCustomizationRepository.save — reference', () => {
  it('writes <workspace>/references/<slug>.md', async () => {
    const repo = new FsCustomizationRepository(workspace);
    await repo.save({ customization: reference('bar') });

    const target = join(workspace, 'references', 'bar.md');
    const raw = await readFile(target, 'utf8');
    expect(raw).toContain('# Bar');
  });
});

describe('FsCustomizationRepository.save — agent', () => {
  it('writes <workspace>/agents/<slug>.md', async () => {
    const repo = new FsCustomizationRepository(workspace);
    await repo.save({ customization: agent('baz') });

    const target = join(workspace, 'agents', 'baz.md');
    const raw = await readFile(target, 'utf8');
    expect(raw).toContain('# Baz');
  });
});

describe('FsCustomizationRepository.delete', () => {
  it('removes <workspace>/skills/<slug>/ recursively for skills', async () => {
    const repo = new FsCustomizationRepository(workspace);
    await repo.save({ customization: skill('foo') });

    await repo.delete({ id: 'skill/foo' });

    await expect(fs.stat(join(workspace, 'skills', 'foo'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('removes the file (not the directory) for references', async () => {
    const repo = new FsCustomizationRepository(workspace);
    await repo.save({ customization: reference('bar') });

    await repo.delete({ id: 'reference/bar' });

    await expect(fs.stat(join(workspace, 'references', 'bar.md'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('removes the file (not the directory) for agents', async () => {
    const repo = new FsCustomizationRepository(workspace);
    await repo.save({ customization: agent('baz') });

    await repo.delete({ id: 'agent/baz' });

    await expect(fs.stat(join(workspace, 'agents', 'baz.md'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('rejects with kind=not_found for non-existing id', async () => {
    const repo = new FsCustomizationRepository(workspace);
    await expect(repo.delete({ id: 'skill/missing' })).rejects.toBeInstanceOf(DomainError);
    await expect(repo.delete({ id: 'skill/missing' })).rejects.toMatchObject({
      kind: 'not_found',
    });
  });

  it('does NOT touch any path outside the workspace (sentinel test)', async () => {
    const sentinelDir = await mkdtemp(join(tmpdir(), 'sde-fs-sentinel-'));
    const sentinel = join(sentinelDir, 'sentinel.md');
    await writeFile(sentinel, 'untouched', 'utf8');

    try {
      const repo = new FsCustomizationRepository(workspace);
      await repo.save({ customization: skill('foo') });
      await repo.delete({ id: 'skill/foo' });

      const after = await readFile(sentinel, 'utf8');
      expect(after).toBe('untouched');
    } finally {
      await rm(sentinelDir, { recursive: true, force: true });
    }
  });
});

describe('FsCustomizationRepository.list and get', () => {
  it('list({ type }) returns only customizations of that type', async () => {
    const repo = new FsCustomizationRepository(workspace);
    await repo.save({ customization: skill('foo') });
    await repo.save({ customization: reference('bar') });
    await repo.save({ customization: agent('baz') });

    const skills = await repo.list({ type: 'skill' });
    expect(skills.map((a) => a.id)).toEqual(['skill/foo']);
  });

  it('list() without filter returns all types', async () => {
    const repo = new FsCustomizationRepository(workspace);
    await repo.save({ customization: skill('foo') });
    await repo.save({ customization: reference('bar') });
    await repo.save({ customization: agent('baz') });

    const all = await repo.list();
    const ids = all.map((a) => a.id).sort();
    expect(ids).toEqual(['agent/baz', 'reference/bar', 'skill/foo']);
  });

  it('list() returns [] when workspace has no customizations', async () => {
    const repo = new FsCustomizationRepository(workspace);
    const all = await repo.list();
    expect(all).toEqual([]);
  });

  it('get reads the file and returns parsed frontmatter and body', async () => {
    const repo = new FsCustomizationRepository(workspace);
    await repo.save({ customization: skill('foo') });

    const result = await repo.get({ id: 'skill/foo' });
    expect(result.id).toBe('skill/foo');
    expect(result.frontmatter.name).toBe('foo');
    expect(result.body).toContain('# Foo');
  });

  it('get rejects with kind=not_found for missing id', async () => {
    const repo = new FsCustomizationRepository(workspace);
    await expect(repo.get({ id: 'skill/missing' })).rejects.toMatchObject({
      kind: 'not_found',
    });
  });

  it('exists returns true after save and false after delete', async () => {
    const repo = new FsCustomizationRepository(workspace);
    expect(await repo.exists({ id: 'skill/foo' })).toBe(false);

    await repo.save({ customization: skill('foo') });
    expect(await repo.exists({ id: 'skill/foo' })).toBe(true);

    await repo.delete({ id: 'skill/foo' });
    expect(await repo.exists({ id: 'skill/foo' })).toBe(false);
  });
});

describe('FsCustomizationRepository.list — ignora entradas espúrias', () => {
  it('ignora .DS_Store em skills/ (arquivo, não diretório)', async () => {
    const repo = new FsCustomizationRepository(workspace);
    await repo.save({ customization: skill('foo') });
    await writeFile(join(workspace, 'skills', '.DS_Store'), 'binary', 'utf8');

    const skills = await repo.list({ type: 'skill' });
    expect(skills.map((a) => a.id)).toEqual(['skill/foo']);
  });

  it('ignora .DS_Store em references/', async () => {
    const repo = new FsCustomizationRepository(workspace);
    await repo.save({ customization: reference('bar') });
    await writeFile(join(workspace, 'references', '.DS_Store'), 'binary', 'utf8');

    const refs = await repo.list({ type: 'reference' });
    expect(refs.map((a) => a.id)).toEqual(['reference/bar']);
  });

  it('ignora .DS_Store em agents/', async () => {
    const repo = new FsCustomizationRepository(workspace);
    await repo.save({ customization: agent('baz') });
    await writeFile(join(workspace, 'agents', '.DS_Store'), 'binary', 'utf8');

    const agents = await repo.list({ type: 'agent' });
    expect(agents.map((a) => a.id)).toEqual(['agent/baz']);
  });
});

describe('FsCustomizationRepository.save — atomicity', () => {
  it('writes via tempfile + rename (sibling tempfile in same directory)', async () => {
    const repo = new FsCustomizationRepository(workspace);
    const target = join(workspace, 'skills', 'foo', 'SKILL.md');
    await repo.save({ customization: skill('foo') });

    const dir = dirname(target);
    const entries = await fs.readdir(dir);
    expect(entries).toEqual(['SKILL.md']);
  });
});
