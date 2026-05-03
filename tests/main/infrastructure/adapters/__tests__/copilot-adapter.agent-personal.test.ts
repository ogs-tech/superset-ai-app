import { describe, expect, it } from 'vitest';
import { isAbsolute, join } from 'node:path';
import { CopilotAdapter } from '../../../../../src/main/infrastructure/adapters/copilot-adapter.js';
import type { Artifact } from '../../../../../src/shared/artifact.js';

const HOMEDIR = '/Users/alice';

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
  it('returns exactly one destination under <homedir>/.copilot/agents/<slug>.agent.md', () => {
    const adapter = new CopilotAdapter({ homedir: HOMEDIR });

    const destinations = adapter.resolveDestinations({
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

  it('returns an absolute destination', () => {
    const adapter = new CopilotAdapter({ homedir: HOMEDIR });

    const [destination] = adapter.resolveDestinations({
      artifact: agentPersonal,
      linkedRepos: [],
    });

    expect(destination?.destination).toBeDefined();
    expect(isAbsolute(destination!.destination)).toBe(true);
  });
});
