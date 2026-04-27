import { describe, expect, it } from 'vitest';
import { FakeAdapter } from '../../../../../src/main/application/services/__fixtures__/fake-adapter.js';
import { setupAdapterManager, defaultSettings } from './adapter-manager.helpers.js';

describe('AdapterManager.syncOne with empty linkedRepos', () => {
  it('returns a skipped SyncResult for project artifacts when no linked repos exist', async () => {
    const adapters = [
      new FakeAdapter('claude', '/workspace/personal/claude'),
      new FakeAdapter('copilot', '/workspace/personal/copilot'),
    ];
    const settings = { ...defaultSettings, linkedRepos: [] };
    const { manager, registerArtifact } = await setupAdapterManager(adapters, settings);
    const artifact = {
      id: 'reference/empty',
      frontmatter: {
        slug: 'empty',
        name: 'Empty',
        type: 'reference' as const,
        description: 'empty artifact',
        scope: 'project' as const,
        version: '1.0.0',
        createdAt: '',
        updatedAt: '',
      },
      body: '# empty',
    };
    await registerArtifact(artifact);

    const result = await manager.syncOne({ artifact });

    expect(result).toHaveLength(2);
    for (const item of result) {
      expect(item.status).toBe('ok');
      expect(item.destination).toBeNull();
      expect(item.details).toEqual({ skipped: 'no-linked-repos' });
    }
  });
});
