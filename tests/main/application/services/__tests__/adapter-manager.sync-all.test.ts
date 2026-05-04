import { describe, expect, it } from 'vitest';
import { FakeAdapter } from '../../../../../src/main/application/services/__fixtures__/fake-adapter.js';
import { setupAdapterManager, defaultSettings } from './adapter-manager.helpers.js';
import type { Customization } from '../../../../../src/shared/customization.js';

const baseCustomization = (overrides: Partial<Customization['frontmatter']> = {}): Customization => ({
  id: `${overrides.type ?? 'skill'}/${overrides.name ?? 'foo'}`,
  frontmatter: {
    name: 'foo',
    type: 'skill',
    description: 'desc',
    scopes: ['personal'],
    version: '1.0.0',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  },
  body: '# foo',
});

describe('AdapterManager.syncAll', () => {
  it('aggregates results across all customizations and enabled adapters', async () => {
    const adapters = [
      new FakeAdapter('claude', '/personal/claude/{slug}'),
      new FakeAdapter('copilot', '/personal/copilot/{slug}'),
    ];
    const { manager, registerCustomization, fs } = await setupAdapterManager(adapters);
    const skill = baseCustomization({ name: 'alpha', type: 'skill' });
    const reference = baseCustomization({ name: 'beta', type: 'reference' });
    await registerCustomization(skill);
    await registerCustomization(reference);
    fs.createFile('/workspace/skills/alpha/SKILL.md', '# alpha');
    fs.createFile('/workspace/references/beta.md', '# beta');

    const results = await manager.syncAll({});

    expect(results).toHaveLength(4);
    const adapterIds = results.map((r) => r.adapter).sort();
    expect(adapterIds).toEqual(['claude', 'claude', 'copilot', 'copilot']);
  });

  it('filters by adapterId when provided', async () => {
    const adapters = [
      new FakeAdapter('claude', '/personal/claude'),
      new FakeAdapter('copilot', '/personal/copilot'),
    ];
    const { manager, registerCustomization, fs } = await setupAdapterManager(adapters);
    const skill = baseCustomization({ name: 'alpha', type: 'skill' });
    await registerCustomization(skill);
    fs.createFile('/workspace/skills/alpha/SKILL.md', '# alpha');

    const results = await manager.syncAll({ adapterId: 'claude' });

    expect(results).toHaveLength(1);
    expect(results[0]?.adapter).toBe('claude');
  });

  it('returns skipped result for project customizations when no linkedRepos', async () => {
    const adapter = new FakeAdapter('claude', '/personal/claude');
    const settings = { ...defaultSettings, linkedRepos: [] };
    const { manager, registerCustomization } = await setupAdapterManager([adapter], settings);
    const projectRef = baseCustomization({ name: 'gamma', type: 'reference', scopes: ['project'] });
    await registerCustomization(projectRef);

    const results = await manager.syncAll({});

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      adapter: 'claude',
      destination: null,
      status: 'ok',
      details: { skipped: 'no-linked-repos' },
    });
  });

  it('falls back to defaults when SettingsService.load returns null', async () => {
    const adapter = new FakeAdapter('claude', '/personal/claude');
    const { manager } = await setupAdapterManager([adapter]);

    const results = await manager.syncAll({});

    expect(results).toEqual([]);
  });
});

describe('AdapterManager error mapping', () => {
  it('maps generic Error from symlinkManager into status=error envelope', async () => {
    const adapter = new FakeAdapter('claude', '/personal/claude');
    const { manager, registerCustomization, symlinkManager } = await setupAdapterManager([adapter]);
    const skill = baseCustomization({ name: 'omega', type: 'skill' });
    await registerCustomization(skill);
    (symlinkManager as unknown as { create: (args: { source: string; destination: string }) => Promise<never> }).create = async () => {
      throw new Error('disk on fire');
    };

    const results = await manager.syncOne({ customization: skill });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      adapter: 'claude',
      status: 'error',
      message: 'disk on fire',
    });
  });
});
