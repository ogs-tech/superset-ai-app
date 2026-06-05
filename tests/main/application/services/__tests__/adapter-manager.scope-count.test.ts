import { describe, expect, it } from 'vitest';
import { FakeAdapter } from '../../../../../src/main/application/services/__fixtures__/fake-adapter.js';
import { setupAdapterManager, defaultSettings } from './adapter-manager.helpers.js';

const settings = {
  ...defaultSettings,
  linkedRepos: [
    { id: 'a', name: 'A', path: '/repo/a' },
    { id: 'b', name: 'B', path: '/repo/b' },
    { id: 'c', name: 'C', path: '/repo/c' },
  ],
};

describe('AdapterManager.syncOne counts destinations by scope', () => {
  it('returns 3 results for project scope with 1 adapter and 3 repos', async () => {
    const adapters = [new FakeAdapter('claude', '/workspace/personal/claude')];
    const { manager, fs, registerCustomization } = await setupAdapterManager(adapters, settings);
    const customization = {
      id: 'agent/foo',
      frontmatter: {
        name: 'foo',
        type: 'agent' as const,
        description: 'desc',
        scopes: ['project' as const],
        version: '1.0.0',
        createdAt: '',
        updatedAt: '',
      },
      body: '# foo',
    };
    await registerCustomization(customization);
    fs.createFile('/workspace/agents/foo.md', '# foo');

    const result = await manager.syncOne({ customization });

    expect(result).toHaveLength(3);
    expect(result.filter((item) => item.adapter === 'claude')).toHaveLength(3);
  });

  it('returns 1 result for personal scope with 1 adapter', async () => {
    const adapters = [new FakeAdapter('claude', '/workspace/personal/claude')];
    const { manager, fs, registerCustomization } = await setupAdapterManager(
      adapters,
      defaultSettings,
    );
    const customization = {
      id: 'skill/foo',
      frontmatter: {
        name: 'foo',
        type: 'skill' as const,
        description: 'desc',
        scopes: ['personal' as const],
        version: '1.0.0',
        createdAt: '',
        updatedAt: '',
      },
      body: '# foo',
    };
    await registerCustomization(customization);
    fs.createFile('/workspace/skills/foo/SKILL.md', '# foo');

    const result = await manager.syncOne({ customization });

    expect(result).toHaveLength(1);
  });
});
