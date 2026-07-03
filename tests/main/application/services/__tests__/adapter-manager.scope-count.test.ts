import { describe, expect, it } from 'vitest';
import { FakeAdapter } from '../../../../../src/main/application/services/__fixtures__/fake-adapter.js';
import { setupAdapterManager, defaultSettings } from './adapter-manager.helpers.js';
import { WORKSPACE_SOURCE, type Agent, type Skill } from '../../../../../src/shared/entity.js';

const meta = { version: '1.0.0', createdAt: '', updatedAt: '' };

const settings = {
  ...defaultSettings,
  linkedRepos: [
    { id: 'a', name: 'A', path: '/repo/a' },
    { id: 'b', name: 'B', path: '/repo/b' },
    { id: 'c', name: 'C', path: '/repo/c' },
  ],
};

describe('AdapterManager.syncEntity counts destinations by scope', () => {
  it('returns 3 results for project scope with 1 adapter and 3 repos', async () => {
    const adapters = [new FakeAdapter('claude', '/workspace/personal/claude')];
    const { manager, fs, registerEntity } = await setupAdapterManager(adapters, settings);
    const entity: Agent = {
      urn: 'urn:agent:foo',
      kind: 'agent',
      name: 'foo',
      description: 'desc',
      scopes: ['project'],
      metadata: meta,
      source: WORKSPACE_SOURCE,
      systemPrompt: '# foo',
    };
    await registerEntity(entity);
    fs.createFile('/workspace/agents/foo.md', '# foo');

    const result = await manager.syncEntity({ entity });

    expect(result).toHaveLength(3);
    expect(result.filter((item) => item.adapter === 'claude')).toHaveLength(3);
  });

  it('returns 1 result for personal scope with 1 adapter', async () => {
    const adapters = [new FakeAdapter('claude', '/workspace/personal/claude')];
    const { manager, fs, registerEntity } = await setupAdapterManager(adapters, defaultSettings);
    const entity: Skill = {
      urn: 'urn:skill:foo',
      kind: 'skill',
      name: 'foo',
      description: 'desc',
      scopes: ['personal'],
      metadata: meta,
      source: WORKSPACE_SOURCE,
      content: '# foo',
    };
    await registerEntity(entity);
    fs.createFile('/workspace/skills/foo/SKILL.md', '# foo');

    const result = await manager.syncEntity({ entity });

    expect(result).toHaveLength(1);
  });
});
