import { describe, expect, it } from 'vitest';
import { isAbsolute, join } from 'node:path';
import type { Artifact } from '../../../../../src/shared/artifact.js';
import type { LinkedRepo } from '../../../../../src/shared/settings.js';
import { makeAdapter } from './copilot-adapter.helpers.js';

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
  it('returns one destination per linkedRepo under <repo>/.github/agents/<slug>.agent.md', async () => {
    const adapter = makeAdapter();

    const destinations = await adapter.resolveDestinations({
      artifact: agentProject,
      linkedRepos: repos,
    });

    expect(destinations).toEqual([
      { scope: 'project', destination: join('/r1', '.github/agents', 'triage.agent.md') },
      { scope: 'project', destination: join('/r2', '.github/agents', 'triage.agent.md') },
    ]);
  });

  it('returns absolute destinations', async () => {
    const adapter = makeAdapter();

    const destinations = await adapter.resolveDestinations({
      artifact: agentProject,
      linkedRepos: repos,
    });

    for (const d of destinations) {
      expect(isAbsolute(d.destination)).toBe(true);
    }
  });

  it('returns [] when scope is project and linkedRepos is empty', async () => {
    const adapter = makeAdapter();

    const destinations = await adapter.resolveDestinations({
      artifact: agentProject,
      linkedRepos: [],
    });

    expect(destinations).toEqual([]);
  });
});
