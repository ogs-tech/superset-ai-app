import { describe, expect, it } from 'vitest';
import { FakeAdapter } from '../../../../../src/main/application/services/__fixtures__/fake-adapter.js';
import { setupAdapterManager } from './adapter-manager.helpers.js';
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

describe('AdapterManager.removeAllAdapterSymlinks', () => {
  it('removes workspace-pointing symlinks across every registered adapter and aggregates the result', async () => {
    const claude = new FakeAdapter('claude', '/personal/claude/skills/alpha');
    const other = new FakeAdapter('other', '/personal/other/skills/alpha');
    const { manager, registerCustomization, fs } = await setupAdapterManager([claude, other]);

    await registerCustomization(baseCustomization({ name: 'alpha', type: 'skill' }));
    await fs.symlink({ target: '/workspace/skills/alpha', path: '/personal/claude/skills/alpha' });
    await fs.symlink({ target: '/workspace/skills/alpha', path: '/personal/other/skills/alpha' });

    const result = await manager.removeAllAdapterSymlinks();

    expect(result).toEqual({ removed: 2, skipped: 0, errors: [] });
    expect(await fs.pathExists('/personal/claude/skills/alpha')).toBe(false);
    expect(await fs.pathExists('/personal/other/skills/alpha')).toBe(false);
  });

  it('leaves symlinks that point outside the workspace untouched (counts them as skipped)', async () => {
    const claude = new FakeAdapter('claude', '/personal/claude/skills/alpha');
    const { manager, registerCustomization, fs } = await setupAdapterManager([claude]);

    await registerCustomization(baseCustomization({ name: 'alpha', type: 'skill' }));
    // A symlink the user created by hand, pointing elsewhere — restore must not touch it.
    await fs.symlink({ target: '/somewhere/else/alpha', path: '/personal/claude/skills/alpha' });

    const result = await manager.removeAllAdapterSymlinks();

    expect(result).toEqual({ removed: 0, skipped: 1, errors: [] });
    expect(await fs.pathExists('/personal/claude/skills/alpha')).toBe(true);
  });

  it('returns zeroed totals when there are no adapters', async () => {
    const { manager } = await setupAdapterManager([]);

    const result = await manager.removeAllAdapterSymlinks();

    expect(result).toEqual({ removed: 0, skipped: 0, errors: [] });
  });
});
