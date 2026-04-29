import { describe, expect, it } from 'vitest';
import { isAbsolute } from 'node:path';
import { ClaudeAdapter } from '../../../../../src/main/infrastructure/adapters/claude-adapter.js';
import type { Artifact } from '../../../../../src/shared/artifact.js';
import type { LinkedRepo } from '../../../../../src/shared/settings.js';

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

const agentProject: Artifact = {
  id: 'agent/triage',
  frontmatter: {
    name: 'triage',
    type: 'agent',
    description: 'desc',
    scopes: ['project'],
    version: '1.0.0',
    createdAt: '',
    updatedAt: '',
  },
  body: '# triage',
};

describe('ClaudeAdapter — paths with spaces/accents', () => {
  it('preserves spaces and accents in homedir', () => {
    const adapter = new ClaudeAdapter({ homedir: '/Users/José Silva' });

    const [destination] = adapter.resolveDestinations({
      artifact: skillPersonal,
      linkedRepos: [],
    });

    expect(destination?.destination).toBe('/Users/José Silva/.claude/skills/review');
    expect(isAbsolute(destination!.destination)).toBe(true);
  });

  it('preserves spaces and parens in repo paths', () => {
    const adapter = new ClaudeAdapter({ homedir: '/Users/José Silva' });
    const repos: LinkedRepo[] = [{ id: 'r', name: 'r', path: '/Users/x/My Repo (work)' }];

    const destinations = adapter.resolveDestinations({
      artifact: agentProject,
      linkedRepos: repos,
    });

    expect(destinations).toEqual([
      {
        scope: 'project',
        destination: '/Users/x/My Repo (work)/.claude/agents/triage.md',
      },
    ]);
    for (const d of destinations) {
      expect(isAbsolute(d.destination)).toBe(true);
    }
  });
});
