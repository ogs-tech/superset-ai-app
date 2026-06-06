import { describe, expect, it } from 'vitest';
import { isAbsolute } from 'node:path';
import { ClaudeAdapter } from '../../../../../src/main/infrastructure/adapters/claude-adapter.js';
import type { Customization } from '../../../../../src/shared/customization.js';

const commandPersonal: Customization = {
  id: 'command/deploy',
  frontmatter: {
    name: 'deploy',
    type: 'command',
    description: 'desc',
    scopes: ['personal'],
    version: '1.0.0',
    createdAt: '',
    updatedAt: '',
  },
  body: '# deploy',
};

describe('ClaudeAdapter — command + personal', () => {
  it('returns exactly one destination at <homedir>/.claude/commands/<slug>.md', () => {
    const adapter = new ClaudeAdapter({ homedir: '/Users/alice' });

    const destinations = adapter.resolveDestinations({
      customization: commandPersonal,
      linkedRepos: [],
    });

    expect(destinations).toEqual([
      { scope: 'personal', destination: '/Users/alice/.claude/commands/deploy.md' },
    ]);
  });

  it('returns an absolute destination', () => {
    const adapter = new ClaudeAdapter({ homedir: '/Users/alice' });

    const [destination] = adapter.resolveDestinations({
      customization: commandPersonal,
      linkedRepos: [],
    });

    expect(isAbsolute(destination!.destination)).toBe(true);
  });
});
