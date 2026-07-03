import { describe, expect, it } from 'vitest';
import { FakeAdapter } from '../../../../../src/main/application/services/__fixtures__/fake-adapter.js';
import { setupAdapterManager, defaultSettings } from './adapter-manager.helpers.js';
import { WORKSPACE_SOURCE, type Skill } from '../../../../../src/shared/entity.js';

describe('AdapterManager.syncEntity — multi-scope + empty linkedRepos', () => {
  it('still syncs personal destinations and emits skipped entry for project when scopes includes both', async () => {
    const claude = new FakeAdapter('claude', '/personal/claude/skills/multi');
    const settings = { ...defaultSettings, linkedRepos: [] };
    const { manager, registerEntity, fs } = await setupAdapterManager([claude], settings);
    const entity: Skill = {
      urn: 'urn:skill:multi',
      kind: 'skill',
      name: 'multi',
      description: 'multi-scope entity',
      scopes: ['personal', 'project'],
      metadata: { version: '1.0.0', createdAt: '', updatedAt: '' },
      source: WORKSPACE_SOURCE,
      content: '# multi',
    };
    await registerEntity(entity);
    fs.createFile('/workspace/skills/multi/SKILL.md', '# multi');

    const results = await manager.syncEntity({ entity });

    expect(results).toHaveLength(2);
    const personal = results.find((r) => r.destination === '/personal/claude/skills/multi');
    expect(personal?.status).toBe('ok');
    expect(personal?.details).toBeUndefined();

    const skipped = results.find((r) => r.destination === null);
    expect(skipped?.status).toBe('ok');
    expect(skipped?.details).toEqual({ skipped: 'no-linked-repos' });
  });
});
