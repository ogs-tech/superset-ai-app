import { describe, expect, it } from 'vitest';
import { isAbsolute } from 'node:path';
import { ClaudeAdapter } from '../../../../../src/main/infrastructure/adapters/claude-adapter.js';
import type { Customization } from '../../../../../src/shared/customization.js';
import type { LinkedRepo } from '../../../../../src/shared/settings.js';

const skillProject: Customization = {
  id: 'skill/review',
  frontmatter: {
    name: 'review',
    type: 'skill',
    description: 'desc',
    scopes: ['project'],
    version: '1.0.0',
    createdAt: '',
    updatedAt: '',
  },
  body: '# review',
};

const repos: LinkedRepo[] = [
  { id: 'r1', name: 'r1', path: '/r1' },
  { id: 'r2', name: 'r2', path: '/r2' },
];

describe('ClaudeAdapter — skill + project', () => {
  it('returns one destination per linkedRepo under <repo>/.claude/skills/<slug>', () => {
    const adapter = new ClaudeAdapter({ homedir: '/Users/alice' });

    const destinations = adapter.resolveDestinations({
      customization: skillProject,
      linkedRepos: repos,
    });

    expect(destinations).toEqual([
      { scope: 'project', destination: '/r1/.claude/skills/review' },
      { scope: 'project', destination: '/r2/.claude/skills/review' },
    ]);
  });

  it('returns absolute destinations', () => {
    const adapter = new ClaudeAdapter({ homedir: '/Users/alice' });

    const destinations = adapter.resolveDestinations({
      customization: skillProject,
      linkedRepos: repos,
    });

    for (const d of destinations) {
      expect(isAbsolute(d.destination)).toBe(true);
    }
  });

  it('returns [] when scope is project and linkedRepos is empty', () => {
    const adapter = new ClaudeAdapter({ homedir: '/Users/alice' });

    const destinations = adapter.resolveDestinations({
      customization: skillProject,
      linkedRepos: [],
    });

    expect(destinations).toEqual([]);
  });
});
