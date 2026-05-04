import { describe, expect, it } from 'vitest';
import { FakeAdapter } from '../../../../../src/main/application/services/__fixtures__/fake-adapter.js';
import { setupAdapterManager, defaultSettings } from './adapter-manager.helpers.js';
import type { Artifact } from '../../../../../src/shared/artifact.js';
import type { Settings } from '../../../../../src/shared/settings.js';

const baseArtifact = (overrides: Partial<Artifact['frontmatter']> = {}): Artifact => ({
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
  it('removes symlinks for a single artifact across all registered adapters', async () => {
    const claude = new FakeAdapter('claude', '/personal/claude/skills/alpha');
    const copilot = new FakeAdapter('copilot', '/personal/copilot/skills/alpha');
    const { manager, registerArtifact, fs } = await setupAdapterManager([claude, copilot]);
    const skill = baseArtifact({ name: 'alpha', type: 'skill' });
    await registerArtifact(skill);
    fs.createFile('/workspace/skills/alpha/SKILL.md', '# alpha');
    await fs.symlink({ target: '/workspace/skills/alpha', path: '/personal/claude/skills/alpha' });
    await fs.symlink({ target: '/workspace/skills/alpha', path: '/personal/copilot/skills/alpha' });

    const results = await manager.removeOne({ artifact: skill });

    expect(results).toHaveLength(2);
    expect(results.map((r) => r.adapter).sort()).toEqual(['claude', 'copilot']);
    expect(results.every((r) => r.status === 'ok')).toBe(true);
    expect(await fs.pathExists('/personal/claude/skills/alpha')).toBe(false);
    expect(await fs.pathExists('/personal/copilot/skills/alpha')).toBe(false);
  });

  it('removes symlinks even when adapter is disabled in settings', async () => {
    const adapter = new FakeAdapter('claude', '/personal/claude/skills/beta');
    const disabled: Settings = {
      ...defaultSettings,
      adapters: {
        claude: { enabled: false },
        copilot: { enabled: false, exclusiveSkillsWithClaude: false },
      },
    };
    const { manager, registerArtifact, fs } = await setupAdapterManager([adapter], disabled);
    const skill = baseArtifact({ name: 'beta', type: 'skill' });
    await registerArtifact(skill);
    await fs.symlink({ target: '/workspace/skills/beta', path: '/personal/claude/skills/beta' });

    const results = await manager.removeOne({ artifact: skill });

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
    const { manager, registerArtifact } = await setupAdapterManager([adapter]);
    const skill = baseArtifact({ name: 'missing', type: 'skill' });
    await registerArtifact(skill);

    const results = await manager.removeOne({ artifact: skill });

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
    const { manager, registerArtifact, symlinkManager, fs } = await setupAdapterManager([adapter]);
    const skill = baseArtifact({ name: 'omega', type: 'skill' });
    await registerArtifact(skill);
    await fs.symlink({ target: '/workspace/skills/omega', path: '/personal/claude/skills/omega' });
    (symlinkManager as unknown as { removeIfExists: (args: { destination: string }) => Promise<never> }).removeIfExists = async () => {
      throw new Error('disk on fire');
    };

    const results = await manager.removeOne({ artifact: skill });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      adapter: 'claude',
      status: 'error',
      message: 'disk on fire',
    });
  });
});
