import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TemplateSeeder } from '../../../../src/main/application/services/template-seeder.js';

let workspace: string;
let source: string;

beforeEach(async () => {
  workspace = await mkdtemp(join(tmpdir(), 'sde-seed-ws-'));
  source = await mkdtemp(join(tmpdir(), 'sde-seed-src-'));
  await writeFile(
    join(source, 'skill.md'),
    `---\nname: new-skill\ntargetType: skill\ndescription: x\nscopes:\n  - personal\nversion: 0.1.0\n---\n\n# new-skill\n`,
    'utf8',
  );
  await writeFile(
    join(source, 'reference.md'),
    `---\nname: new-reference\ntargetType: reference\ndescription: x\nscopes:\n  - personal\nversion: 0.1.0\n---\n\n# new-reference\n`,
    'utf8',
  );
});

afterEach(async () => {
  await rm(workspace, { recursive: true, force: true });
  await rm(source, { recursive: true, force: true });
});

describe('TemplateSeeder.seedIfMissing', () => {
  it('copies all source files into <workspace>/templates/ on a fresh workspace', async () => {
    const seeder = new TemplateSeeder({ sourceDir: source });
    await seeder.seedIfMissing(workspace);

    const entries = await fs.readdir(join(workspace, 'templates'));
    expect(entries.sort()).toEqual(['reference.md', 'skill.md']);
  });

  it('preserves file content (frontmatter + body) verbatim', async () => {
    const seeder = new TemplateSeeder({ sourceDir: source });
    await seeder.seedIfMissing(workspace);
    const seeded = await readFile(join(workspace, 'templates', 'skill.md'), 'utf8');
    const original = await readFile(join(source, 'skill.md'), 'utf8');
    expect(seeded).toBe(original);
  });

  it('does NOT seed when <workspace>/templates/ already exists (seed-once)', async () => {
    await mkdir(join(workspace, 'templates'), { recursive: true });
    await writeFile(join(workspace, 'templates', 'mine.md'), 'preserved', 'utf8');

    const seeder = new TemplateSeeder({ sourceDir: source });
    await seeder.seedIfMissing(workspace);

    const entries = await fs.readdir(join(workspace, 'templates'));
    expect(entries).toEqual(['mine.md']);
  });

  it('returns the count of seeded files', async () => {
    const seeder = new TemplateSeeder({ sourceDir: source });
    const result = await seeder.seedIfMissing(workspace);
    expect(result.seeded).toBe(2);
  });

  it('returns seeded: 0 when skipped', async () => {
    await mkdir(join(workspace, 'templates'), { recursive: true });
    const seeder = new TemplateSeeder({ sourceDir: source });
    const result = await seeder.seedIfMissing(workspace);
    expect(result.seeded).toBe(0);
  });
});
