import { describe, expect, it } from 'vitest';
import { FakeAdapter } from '../../../../../src/main/application/services/__fixtures__/fake-adapter.js';
import { setupAdapterManager } from './adapter-manager.helpers.js';

describe('AdapterManager.syncOne shape', () => {
  it('delegates to SettingsService and returns SyncResult[] with adapter destination status', async () => {
    const adapter = new FakeAdapter('claude', '/workspace/personal/claude', (repoPath) => `${repoPath}/.claude`);
    const { manager, fs, registerCustomization } = await setupAdapterManager([adapter]);
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
    expect(result[0]).toMatchObject({
      adapter: 'claude',
      destination: '/workspace/personal/claude',
      status: 'ok',
    });
  });
});
