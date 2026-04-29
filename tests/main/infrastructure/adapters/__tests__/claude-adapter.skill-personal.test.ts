import { describe, expect, it } from 'vitest';
import { isAbsolute } from 'node:path';
import { ClaudeAdapter } from '../../../../../src/main/infrastructure/adapters/claude-adapter.js';
import type { Artifact } from '../../../../../src/shared/artifact.js';

const skillPersonal: Artifact = {
  id: 'skill/review',
  frontmatter: {
    name: 'review',
    type: 'skill',
    description: 'desc',
    scopes: ['personal'],
    version: '1.0.0',
    createdAt: '',
    updatedAt: '',
  },
  body: '# review',
};

describe('ClaudeAdapter — skill + personal', () => {
  it('returns exactly one destination under <homedir>/.claude/skills/<slug>', () => {
    const adapter = new ClaudeAdapter({ homedir: '/Users/alice' });

    const destinations = adapter.resolveDestinations({
      artifact: skillPersonal,
      linkedRepos: [],
    });

    expect(destinations).toEqual([
      { scope: 'personal', destination: '/Users/alice/.claude/skills/review' },
    ]);
  });

  it('returns an absolute destination', () => {
    const adapter = new ClaudeAdapter({ homedir: '/Users/alice' });

    const [destination] = adapter.resolveDestinations({
      artifact: skillPersonal,
      linkedRepos: [],
    });

    expect(destination?.destination).toBeDefined();
    expect(isAbsolute(destination!.destination)).toBe(true);
  });
});
