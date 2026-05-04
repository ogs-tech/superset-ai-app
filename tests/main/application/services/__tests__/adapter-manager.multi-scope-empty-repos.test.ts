import { describe, expect, it } from 'vitest';
import { FakeAdapter } from '../../../../../src/main/application/services/__fixtures__/fake-adapter.js';
import { setupAdapterManager, defaultSettings } from './adapter-manager.helpers.js';

describe('AdapterManager.syncOne — multi-scope + empty linkedRepos', () => {
  it('still syncs personal destinations and emits skipped entry for project when scopes includes both', async () => {
    const claude = new FakeAdapter('claude', '/personal/claude/skills/multi');
    const settings = { ...defaultSettings, linkedRepos: [] };
    const { manager, registerCustomization, fs } = await setupAdapterManager([claude], settings);
    const customization = {
      id: 'skill/multi',
      frontmatter: {
        name: 'multi',
        type: 'skill' as const,
        description: 'multi-scope customization',
        scopes: ['personal', 'project'] as Array<'personal' | 'project'>,
        version: '1.0.0',
        createdAt: '',
        updatedAt: '',
      },
      body: '# multi',
    };
    await registerCustomization(customization);
    fs.createFile('/workspace/skills/multi/SKILL.md', '# multi');

    const results = await manager.syncOne({ customization });

    expect(results).toHaveLength(2);
    const personal = results.find((r) => r.destination === '/personal/claude/skills/multi');
    expect(personal?.status).toBe('ok');
    expect(personal?.details).toBeUndefined();

    const skipped = results.find((r) => r.destination === null);
    expect(skipped?.status).toBe('ok');
    expect(skipped?.details).toEqual({ skipped: 'no-linked-repos' });
  });
});
