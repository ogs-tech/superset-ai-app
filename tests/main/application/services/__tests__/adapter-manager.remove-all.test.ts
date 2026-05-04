import { describe, expect, it } from 'vitest';
import { FakeAdapter } from '../../../../../src/main/application/services/__fixtures__/fake-adapter.js';
import { setupAdapterManager, defaultSettings } from './adapter-manager.helpers.js';
import type { Customization } from '../../../../../src/shared/customization.js';
import type { Settings } from '../../../../../src/shared/settings.js';

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

describe('AdapterManager.removeAll', () => {
  it('removes symlinks for all customizations of the given adapter, even when adapter is disabled in settings', async () => {
    const adapter = new FakeAdapter('claude', '/personal/claude/skills/alpha');
    const disabled: Settings = {
      ...defaultSettings,
      adapters: {
        claude: { enabled: false },
        copilot: { enabled: false, exclusiveSkillsWithClaude: false },
      },
    };
    const { manager, registerCustomization, fs } = await setupAdapterManager([adapter], disabled);
    const skill = baseCustomization({ name: 'alpha', type: 'skill' });
    await registerCustomization(skill);
    fs.createFile('/workspace/skills/alpha/SKILL.md', '# alpha');
    await fs.symlink({ target: '/workspace/skills/alpha', path: '/personal/claude/skills/alpha' });

    const results = await manager.removeAll({ adapterId: 'claude' });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      adapter: 'claude',
      destination: '/personal/claude/skills/alpha',
      status: 'ok',
    });
    const exists = await fs.pathExists('/personal/claude/skills/alpha');
    expect(exists).toBe(false);
  });

  it('returns ok with details.skipped="not-found" when symlink does not exist', async () => {
    const adapter = new FakeAdapter('claude', '/personal/claude/skills/missing');
    const { manager, registerCustomization } = await setupAdapterManager([adapter]);
    const skill = baseCustomization({ name: 'missing', type: 'skill' });
    await registerCustomization(skill);

    const results = await manager.removeAll({ adapterId: 'claude' });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      adapter: 'claude',
      destination: '/personal/claude/skills/missing',
      status: 'ok',
      details: { skipped: 'not-found' },
    });
  });

  it('returns empty array when adapterId is not registered', async () => {
    const adapter = new FakeAdapter('claude', '/personal/claude');
    const { manager } = await setupAdapterManager([adapter]);

    const results = await manager.removeAll({ adapterId: 'unknown' });

    expect(results).toEqual([]);
  });

  it('maps generic Error from symlinkManager.remove into status=error envelope', async () => {
    const adapter = new FakeAdapter('claude', '/personal/claude/skills/omega');
    const { manager, registerCustomization, symlinkManager, fs } = await setupAdapterManager([adapter]);
    const skill = baseCustomization({ name: 'omega', type: 'skill' });
    await registerCustomization(skill);
    await fs.symlink({ target: '/workspace/skills/omega', path: '/personal/claude/skills/omega' });
    (symlinkManager as unknown as { removeIfExists: (args: { destination: string }) => Promise<never> }).removeIfExists = async () => {
      throw new Error('disk on fire');
    };

    const results = await manager.removeAll({ adapterId: 'claude' });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      adapter: 'claude',
      status: 'error',
      message: 'disk on fire',
    });
  });
});
