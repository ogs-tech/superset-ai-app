import { describe, expect, it } from 'vitest';
import { getDefaults, type LinkedRepo, type Settings } from '../../src/shared/settings.js';

describe('LinkedRepo', () => {
  it('accepts { id, name, path } without requiring branch', () => {
    const repo = { id: 'r1', name: 'repo', path: '/tmp/repo' } satisfies LinkedRepo;

    expect(repo.id).toBe('r1');
    expect(repo.name).toBe('repo');
    expect(repo.path).toBe('/tmp/repo');
  });
});

describe('getDefaults', () => {
  it('returns the canonical default Settings', () => {
    const defaults: Settings = getDefaults();

    expect(defaults).toEqual({
      workspacePath: '',
      adapters: {
        claude: { enabled: true },
        copilot: { enabled: false },
      },
      linkedRepos: [],
      ui: { theme: 'system' },
    });
  });

  it('returns a fresh object on each call (no shared mutable state)', () => {
    const a = getDefaults();
    const b = getDefaults();

    expect(a).not.toBe(b);
    expect(a.linkedRepos).not.toBe(b.linkedRepos);
    expect(a.adapters).not.toBe(b.adapters);
  });
});
