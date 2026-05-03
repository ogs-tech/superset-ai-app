import { describe, expect, it } from 'vitest';
import { isAbsolute, join } from 'node:path';
import { CopilotAdapter } from '../../../../../src/main/infrastructure/adapters/copilot-adapter.js';
import type { Artifact } from '../../../../../src/shared/artifact.js';
import type { LinkedRepo } from '../../../../../src/shared/settings.js';

const HOMEDIR = '/Users/alice';

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

describe('CopilotAdapter — agent + project (AC#5, AC#7, AC#8)', () => {
  it('returns one destination per linkedRepo under <repo>/.github/agents/<slug>.agent.md', () => {
    const adapter = new CopilotAdapter({ homedir: HOMEDIR });

    const destinations = adapter.resolveDestinations({
      artifact: agentProject,
      linkedRepos: repos,
    });

    expect(destinations).toEqual([
      { scope: 'project', destination: join('/r1', '.github/agents', 'triage.agent.md') },
      { scope: 'project', destination: join('/r2', '.github/agents', 'triage.agent.md') },
    ]);
  });

  it('returns absolute destinations', () => {
    const adapter = new CopilotAdapter({ homedir: HOMEDIR });

    const destinations = adapter.resolveDestinations({
      artifact: agentProject,
      linkedRepos: repos,
    });

    for (const d of destinations) {
      expect(isAbsolute(d.destination)).toBe(true);
    }
  });

  it('returns [] when scope is project and linkedRepos is empty', () => {
    const adapter = new CopilotAdapter({ homedir: HOMEDIR });

    const destinations = adapter.resolveDestinations({
      artifact: agentProject,
      linkedRepos: [],
    });

    expect(destinations).toEqual([]);
  });
});
