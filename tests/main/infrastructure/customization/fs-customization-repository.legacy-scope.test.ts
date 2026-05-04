import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FsCustomizationRepository } from '../../../../src/main/infrastructure/customization/fs-customization-repository.js';

let workspace: string;

beforeEach(async () => {
  workspace = await mkdtemp(join(tmpdir(), 'sde-fs-customization-legacy-'));
});

afterEach(async () => {
  await rm(workspace, { recursive: true, force: true });
});

const writeLegacySkill = async (slug: string, scopeValue: string): Promise<void> => {
  const dir = join(workspace, 'skills', slug);
  await mkdir(dir, { recursive: true });
  const yaml = [
    '---',
    `slug: ${slug}`,
    `name: ${slug}`,
    'type: skill',
    'description: legacy customization',
    `scope: ${scopeValue}`,
    'version: 0.1.0',
    "createdAt: '2026-01-01T00:00:00.000Z'",
    "updatedAt: '2026-01-01T00:00:00.000Z'",
    '---',
    `# ${slug}`,
    '',
  ].join('\n');
  await writeFile(join(dir, 'SKILL.md'), yaml, 'utf8');
};

describe('FsCustomizationRepository — legacy scope auto-migration', () => {
  it('returns scopes: ["personal"] when reading a legacy file with scope: personal', async () => {
    await writeLegacySkill('alpha', 'personal');
    const repo = new FsCustomizationRepository(workspace);

    const loaded = await repo.get({ id: 'skill/alpha' });

    expect(loaded.frontmatter.scopes).toEqual(['personal']);
    expect((loaded.frontmatter as unknown as { scope?: string }).scope).toBeUndefined();
  });

  it('returns scopes: ["project"] when reading a legacy file with scope: project', async () => {
    await writeLegacySkill('beta', 'project');
    const repo = new FsCustomizationRepository(workspace);

    const loaded = await repo.list({ type: 'skill' });

    expect(loaded).toHaveLength(1);
    expect(loaded[0]!.frontmatter.scopes).toEqual(['project']);
  });

  it('persists scopes (and drops legacy scope) on re-save', async () => {
    await writeLegacySkill('gamma', 'personal');
    const repo = new FsCustomizationRepository(workspace);
    const loaded = await repo.get({ id: 'skill/gamma' });

    await repo.save({ customization: loaded });

    const onDisk = await readFile(join(workspace, 'skills', 'gamma', 'SKILL.md'), 'utf8');
    expect(onDisk).toMatch(/^scopes:/m);
    expect(onDisk).not.toMatch(/^scope:/m);
  });
});
