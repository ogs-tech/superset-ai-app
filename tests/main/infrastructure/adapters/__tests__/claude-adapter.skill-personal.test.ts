import { describe, expect, it } from 'vitest';
import { isAbsolute } from 'node:path';
import { ClaudeAdapter } from '../../../../../src/main/infrastructure/adapters/claude-adapter.js';
import type { Customization } from '../../../../../src/shared/customization.js';

const skillPersonal: Customization = {
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
      customization: skillPersonal,
      linkedRepos: [],
    });

    expect(destinations).toEqual([
      { scope: 'personal', destination: '/Users/alice/.claude/skills/review' },
    ]);
  });

  it('returns an absolute destination', () => {
    const adapter = new ClaudeAdapter({ homedir: '/Users/alice' });

    const [destination] = adapter.resolveDestinations({
      customization: skillPersonal,
      linkedRepos: [],
    });

    expect(destination?.destination).toBeDefined();
    expect(isAbsolute(destination!.destination)).toBe(true);
  });
});
