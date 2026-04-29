import { describe, expect, it } from 'vitest';
import { isAbsolute } from 'node:path';
import { ClaudeAdapter } from '../../../../../src/main/infrastructure/adapters/claude-adapter.js';
import type { Artifact } from '../../../../../src/shared/artifact.js';

const agentPersonal: Artifact = {
  id: 'agent/triage',
  frontmatter: {
    name: 'triage',
    type: 'agent',
    description: 'desc',
    scopes: ['personal'],
    version: '1.0.0',
    createdAt: '',
    updatedAt: '',
  },
  body: '# triage',
};

describe('ClaudeAdapter — agent + personal', () => {
  it('returns exactly one destination at <homedir>/.claude/agents/<slug>.md', () => {
    const adapter = new ClaudeAdapter({ homedir: '/Users/alice' });

    const destinations = adapter.resolveDestinations({
      artifact: agentPersonal,
      linkedRepos: [],
    });

    expect(destinations).toEqual([
      { scope: 'personal', destination: '/Users/alice/.claude/agents/triage.md' },
    ]);
  });

  it('returns an absolute destination', () => {
    const adapter = new ClaudeAdapter({ homedir: '/Users/alice' });

    const [destination] = adapter.resolveDestinations({
      artifact: agentPersonal,
      linkedRepos: [],
    });

    expect(isAbsolute(destination!.destination)).toBe(true);
  });
});
