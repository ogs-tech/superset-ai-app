import { describe, it, expect } from 'vitest';
import { InMemoryEntityRepository } from '../../../../src/main/infrastructure/entity/in-memory-entity-repository.js';
import { WORKSPACE_SOURCE, type Skill, type Agent } from '../../../../src/shared/entity.js';

const meta = { version: '0.1.0', createdAt: '', updatedAt: '' };
const skill = (name: string): Skill => ({
  urn: `urn:skill:${name}`, kind: 'skill', name, description: 'd', scopes: ['personal'],
  metadata: meta, source: WORKSPACE_SOURCE, content: 'b',
});
const agent = (name: string): Agent => ({
  urn: `urn:agent:${name}`, kind: 'agent', name, description: 'd', scopes: ['personal'],
  metadata: meta, source: WORKSPACE_SOURCE, systemPrompt: 'b',
});

describe('InMemoryEntityRepository', () => {
  it('saves, gets and lists by kind', async () => {
    const repo = new InMemoryEntityRepository();
    await repo.save(skill('a'));
    await repo.save(agent('b'));
    expect((await repo.list({ kind: 'skill' })).map((e) => e.urn)).toEqual(['urn:skill:a']);
    expect((await repo.get('urn:skill:a')).name).toBe('a');
    expect(await repo.exists('urn:agent:b')).toBe(true);
  });

  it('rejects get on a missing urn with not_found', async () => {
    const repo = new InMemoryEntityRepository();
    await expect(repo.get('urn:skill:nope')).rejects.toMatchObject({ kind: 'not_found' });
  });

  it('rejects delete on a missing urn with not_found', async () => {
    const repo = new InMemoryEntityRepository();
    await expect(repo.delete('urn:skill:nope')).rejects.toMatchObject({ kind: 'not_found' });
  });

  it('deep-clones on read so callers cannot mutate the store', async () => {
    const repo = new InMemoryEntityRepository();
    await repo.save(skill('a'));
    const first = (await repo.get('urn:skill:a')) as Skill;
    first.content = 'mutated';
    expect(((await repo.get('urn:skill:a')) as Skill).content).toBe('b');
  });
});
