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
  it('returns 6 results for project scope with 2 adapters and 3 repos', async () => {
    const adapters = [
      new FakeAdapter('claude', '/workspace/personal/claude'),
      new FakeAdapter('copilot', '/workspace/personal/copilot'),
    ];
    const { manager, fs, registerCustomization } = await setupAdapterManager(adapters, settings);
    const customization = {
      id: 'reference/foo',
      frontmatter: {
        name: 'foo',
        type: 'reference' as const,
        description: 'desc',
        scopes: ['project' as const],
        version: '1.0.0',
        createdAt: '',
        updatedAt: '',
      },
      body: '# foo',
    };
    await registerCustomization(customization);
    fs.createFile('/workspace/references/foo.md', '# foo');

    const result = await manager.syncOne({ customization });

    expect(result).toHaveLength(6);
    expect(result.filter((item) => item.adapter === 'claude')).toHaveLength(3);
    expect(result.filter((item) => item.adapter === 'copilot')).toHaveLength(3);
  });

  it('returns 2 results for personal scope with 2 adapters', async () => {
    const adapters = [
      new FakeAdapter('claude', '/workspace/personal/claude'),
      new FakeAdapter('copilot', '/workspace/personal/copilot'),
    ];
    const { manager, fs, registerCustomization } = await setupAdapterManager(adapters, defaultSettings);
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

    expect(result).toHaveLength(2);
  });
});
