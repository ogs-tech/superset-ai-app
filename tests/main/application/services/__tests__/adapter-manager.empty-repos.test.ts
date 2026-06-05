import { describe, expect, it } from 'vitest';
import { FakeAdapter } from '../../../../../src/main/application/services/__fixtures__/fake-adapter.js';
import { setupAdapterManager, defaultSettings } from './adapter-manager.helpers.js';

describe('AdapterManager.syncOne with empty linkedRepos', () => {
  it('returns a skipped SyncResult for project customizations when no linked repos exist', async () => {
    const adapters = [new FakeAdapter('claude', '/workspace/personal/claude')];
    const settings = { ...defaultSettings, linkedRepos: [] };
    const { manager, registerCustomization } = await setupAdapterManager(adapters, settings);
    const customization = {
      id: 'agent/empty',
      frontmatter: {
        name: 'empty',
        type: 'agent' as const,
        description: 'empty customization',
        scopes: ['project' as const],
        version: '1.0.0',
        createdAt: '',
        updatedAt: '',
      },
      body: '# empty',
    };
    await registerCustomization(customization);

    const result = await manager.syncOne({ customization });

    expect(result).toHaveLength(1);
    for (const item of result) {
      expect(item.status).toBe('ok');
      expect(item.destination).toBeNull();
      expect(item.details).toEqual({ skipped: 'no-linked-repos' });
    }
  });
});
