import { describe, expect, it } from 'vitest';
import { isAbsolute } from 'node:path';
import { ClaudeAdapter } from '../../../../../src/main/infrastructure/adapters/claude-adapter.js';
import type { Artifact } from '../../../../../src/shared/artifact.js';
import type { LinkedRepo } from '../../../../../src/shared/settings.js';

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

const repos: LinkedRepo[] = [
  { id: 'r1', name: 'r1', path: '/r1' },
  { id: 'r2', name: 'r2', path: '/r2' },
];

describe('ClaudeAdapter — agent + project', () => {
  it('returns one destination per linkedRepo at <repo>/.claude/agents/<slug>.md', () => {
    const adapter = new ClaudeAdapter({ homedir: '/Users/alice' });

    const destinations = adapter.resolveDestinations({
      artifact: agentProject,
      linkedRepos: repos,
    });

    expect(destinations).toEqual([
      { scope: 'project', destination: '/r1/.claude/agents/triage.md' },
      { scope: 'project', destination: '/r2/.claude/agents/triage.md' },
    ]);
  });

  it('returns absolute destinations', () => {
    const adapter = new ClaudeAdapter({ homedir: '/Users/alice' });

    const destinations = adapter.resolveDestinations({
      artifact: agentProject,
      linkedRepos: repos,
    });

    for (const d of destinations) {
      expect(isAbsolute(d.destination)).toBe(true);
    }
  });

  it('returns [] when scope is project and linkedRepos is empty', () => {
    const adapter = new ClaudeAdapter({ homedir: '/Users/alice' });

    const destinations = adapter.resolveDestinations({
      artifact: agentProject,
      linkedRepos: [],
    });

    expect(destinations).toEqual([]);
  });
});
