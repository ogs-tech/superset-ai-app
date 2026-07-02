import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FsEntityRepository } from '../../../../src/main/infrastructure/entity/fs-entity-repository.js';
import { WORKSPACE_SOURCE, type Skill, type Instruction } from '../../../../src/shared/entity.js';

const meta = { version: '0.1.0', createdAt: '2026-04-26T10:00:00.000Z', updatedAt: '2026-04-26T10:00:00.000Z' };

let ws: string;
beforeEach(async () => { ws = await mkdtemp(join(tmpdir(), 'sde-fs-entity-')); });
afterEach(async () => { await rm(ws, { recursive: true, force: true }); });

describe('FsEntityRepository — skill', () => {
  it('writes SKILL.md under skills/<name>/ and reads it back', async () => {
    const repo = new FsEntityRepository(ws);
    const skill: Skill = {
      urn: 'urn:skill:demo', kind: 'skill', name: 'demo', description: 'd', scopes: ['personal'],
      metadata: meta, source: WORKSPACE_SOURCE, content: '# Demo\n',
    };
    await repo.save(skill);
    const onDisk = await readFile(join(ws, 'skills', 'demo', 'SKILL.md'), 'utf8');
    expect(onDisk).toContain('name: demo');
    const back = (await repo.get('urn:skill:demo')) as Skill;
    expect(back.content.trim()).toBe('# Demo');
  });
});

describe('FsEntityRepository — instruction', () => {
  it('stores frontmatter-free markdown at instructions/<name>.md', async () => {
    const repo = new FsEntityRepository(ws);
    const ins: Instruction = {
      urn: 'urn:instruction:default', kind: 'instruction', name: 'default', description: '',
      scopes: ['personal'], metadata: meta, source: WORKSPACE_SOURCE, content: '# Hi\n', activation: 'always',
    };
    await repo.save(ins);
    const onDisk = await readFile(join(ws, 'instructions', 'default.md'), 'utf8');
    expect(onDisk.startsWith('---')).toBe(false);
    expect(onDisk).toContain('# Hi');
  });

  it('falls back to legacy global-instructions/default.md on get', async () => {
    await mkdir(join(ws, 'global-instructions'), { recursive: true });
    await writeFile(join(ws, 'global-instructions', 'default.md'),
      ['---', 'name: default', 'type: global-instruction', '---', '# Legacy body', ''].join('\n'), 'utf8');
    const repo = new FsEntityRepository(ws);
    const ins = (await repo.get('urn:instruction:default')) as Instruction;
    expect(ins.content.trim()).toBe('# Legacy body');
  });
});

describe('FsEntityRepository — list & delete', () => {
  it('lists skills and agents, and get on a missing urn rejects not_found', async () => {
    const repo = new FsEntityRepository(ws);
    await repo.save({ urn: 'urn:skill:a', kind: 'skill', name: 'a', description: 'd',
      scopes: ['personal'], metadata: meta, source: WORKSPACE_SOURCE, content: 'b' } as Skill);
    expect((await repo.list({ kind: 'skill' })).map((e) => e.name)).toEqual(['a']);
    await repo.delete('urn:skill:a');
    await expect(repo.get('urn:skill:a')).rejects.toMatchObject({ kind: 'not_found' });
  });
});
