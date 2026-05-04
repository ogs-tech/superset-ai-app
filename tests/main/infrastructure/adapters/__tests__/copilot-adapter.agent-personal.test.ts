import { describe, expect, it } from 'vitest';
import { isAbsolute, join } from 'node:path';
import type { Artifact } from '../../../../../src/shared/artifact.js';
import { HOMEDIR, makeAdapter } from './copilot-adapter.helpers.js';

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

describe('CopilotAdapter — agent + personal (AC#4, AC#8)', () => {
  it('returns exactly one destination under <homedir>/.copilot/agents/<slug>.agent.md', async () => {
    const adapter = makeAdapter();

    const destinations = await adapter.resolveDestinations({
      artifact: agentPersonal,
      linkedRepos: [],
    });

    expect(destinations).toEqual([
      {
        scope: 'personal',
        destination: join(HOMEDIR, '.copilot/agents', 'triage.agent.md'),
      },
    ]);
  });

  it('returns an absolute destination', async () => {
    const adapter = makeAdapter();

    const destinations = await adapter.resolveDestinations({
      artifact: agentPersonal,
      linkedRepos: [],
    });

    const [destination] = destinations;
    expect(destination?.destination).toBeDefined();
    expect(isAbsolute(destination!.destination)).toBe(true);
  });
});
