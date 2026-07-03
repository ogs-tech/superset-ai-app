import { describe, expect, it } from 'vitest';
import { FakeAdapter } from '../../../../../src/main/application/services/__fixtures__/fake-adapter.js';
import { setupAdapterManager, defaultSettings } from './adapter-manager.helpers.js';
import { WORKSPACE_SOURCE, type Agent } from '../../../../../src/shared/entity.js';

describe('AdapterManager.syncEntity with empty linkedRepos', () => {
  it('returns a skipped SyncResult for project entities when no linked repos exist', async () => {
    const adapters = [new FakeAdapter('claude', '/workspace/personal/claude')];
    const settings = { ...defaultSettings, linkedRepos: [] };
    const { manager, registerEntity } = await setupAdapterManager(adapters, settings);
    const entity: Agent = {
      urn: 'urn:agent:empty',
      kind: 'agent',
      name: 'empty',
      description: 'empty entity',
      scopes: ['project'],
      metadata: { version: '1.0.0', createdAt: '', updatedAt: '' },
      source: WORKSPACE_SOURCE,
      systemPrompt: '# empty',
    };
    await registerEntity(entity);

    const result = await manager.syncEntity({ entity });

    expect(result).toHaveLength(1);
    for (const item of result) {
      expect(item.status).toBe('ok');
      expect(item.destination).toBeNull();
      expect(item.details).toEqual({ skipped: 'no-linked-repos' });
    }
  });
});
