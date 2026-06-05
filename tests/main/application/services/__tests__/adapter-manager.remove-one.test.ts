import { describe, expect, it } from 'vitest';
import { FakeAdapter } from '../../../../../src/main/application/services/__fixtures__/fake-adapter.js';
import { setupAdapterManager, defaultSettings } from './adapter-manager.helpers.js';
import type { Customization } from '../../../../../src/shared/customization.js';
import type { Settings } from '../../../../../src/shared/settings.js';

const baseCustomization = (
  overrides: Partial<Customization['frontmatter']> = {},
): Customization => ({
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

describe('AdapterManager.removeOne', () => {
  it('removes symlinks for a single customization across all registered adapters', async () => {
    const claude = new FakeAdapter('claude', '/personal/claude/skills/alpha');
    const { manager, registerCustomization, fs } = await setupAdapterManager([claude]);
    const skill = baseCustomization({ name: 'alpha', type: 'skill' });
    await registerCustomization(skill);
    fs.createFile('/workspace/skills/alpha/SKILL.md', '# alpha');
    await fs.symlink({ target: '/workspace/skills/alpha', path: '/personal/claude/skills/alpha' });

    const results = await manager.removeOne({ customization: skill });

    expect(results).toHaveLength(1);
    expect(results.map((r) => r.adapter).sort()).toEqual(['claude']);
    expect(results.every((r) => r.status === 'ok')).toBe(true);
    expect(await fs.pathExists('/personal/claude/skills/alpha')).toBe(false);
  });

  it('removes symlinks even when adapter is disabled in settings', async () => {
    const adapter = new FakeAdapter('claude', '/personal/claude/skills/beta');
    const disabled: Settings = {
      ...defaultSettings,
      adapters: {
        claude: { enabled: false },
      },
    };
    const { manager, registerCustomization, fs } = await setupAdapterManager([adapter], disabled);
    const skill = baseCustomization({ name: 'beta', type: 'skill' });
    await registerCustomization(skill);
    await fs.symlink({ target: '/workspace/skills/beta', path: '/personal/claude/skills/beta' });

    const results = await manager.removeOne({ customization: skill });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      adapter: 'claude',
      destination: '/personal/claude/skills/beta',
      status: 'ok',
    });
    expect(await fs.pathExists('/personal/claude/skills/beta')).toBe(false);
  });

  it('returns ok with details.skipped="not-found" when symlink does not exist', async () => {
    const adapter = new FakeAdapter('claude', '/personal/claude/skills/missing');
    const { manager, registerCustomization } = await setupAdapterManager([adapter]);
    const skill = baseCustomization({ name: 'missing', type: 'skill' });
    await registerCustomization(skill);

    const results = await manager.removeOne({ customization: skill });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      adapter: 'claude',
      destination: '/personal/claude/skills/missing',
      status: 'ok',
      details: { skipped: 'not-found' },
    });
  });

  it('maps generic Error from symlinkManager.removeIfExists into status=error envelope', async () => {
    const adapter = new FakeAdapter('claude', '/personal/claude/skills/omega');
    const { manager, registerCustomization, symlinkManager, fs } = await setupAdapterManager([
      adapter,
    ]);
    const skill = baseCustomization({ name: 'omega', type: 'skill' });
    await registerCustomization(skill);
    await fs.symlink({ target: '/workspace/skills/omega', path: '/personal/claude/skills/omega' });
    (
      symlinkManager as unknown as {
        removeIfExists: (args: { destination: string }) => Promise<never>;
      }
    ).removeIfExists = async () => {
      throw new Error('disk on fire');
    };

    const results = await manager.removeOne({ customization: skill });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      adapter: 'claude',
      status: 'error',
      message: 'disk on fire',
    });
  });
});
