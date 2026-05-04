import { describe, expect, it } from 'vitest';
import type { Customization } from '../../../../../src/shared/customization.js';
import type { LinkedRepo } from '../../../../../src/shared/settings.js';
import { CopilotAdapter } from '../../../../../src/main/infrastructure/adapters/copilot-adapter.js';
import { makeGen } from './copilot-adapter.helpers.js';

const HOMEDIR_SPECIAL = '/Users/José Silva';
const REPO_PATH = '/Users/x/My Repo (work)';

const skillBoth: Customization = {
  id: 'skill/review',
  frontmatter: {
    name: 'review',
    type: 'skill',
    description: 'desc',
    scopes: ['personal', 'project'],
    version: '1.0.0',
    createdAt: '',
    updatedAt: '',
  },
  body: '# review',
};

const agentBoth: Customization = {
  id: 'agent/triage',
  frontmatter: {
    name: 'triage',
    type: 'agent',
    description: 'desc',
    scopes: ['personal', 'project'],
    version: '1.0.0',
    createdAt: '',
    updatedAt: '',
  },
  body: '# triage',
};

const repos: LinkedRepo[] = [{ id: 'r', name: 'r', path: REPO_PATH }];

describe('CopilotAdapter — paths with spaces/accents (AC#16)', () => {
  it('preserves spaces and accents for skill (personal + project)', async () => {
    const adapter = new CopilotAdapter({
      homedir: HOMEDIR_SPECIAL,
      workspacePath: '/workspace',
      copilotInstructionsGen: makeGen(),
    });

    const destinations = await adapter.resolveDestinations({
      customization: skillBoth,
      linkedRepos: repos,
    });

    expect(destinations).toEqual([
      {
        scope: 'personal',
        destination: '/Users/José Silva/.copilot/skills/review',
      },
      {
        scope: 'project',
        destination: '/Users/x/My Repo (work)/.github/skills/review',
      },
    ]);
  });

  it('preserves spaces and accents for agent (personal + project)', async () => {
    const adapter = new CopilotAdapter({
      homedir: HOMEDIR_SPECIAL,
      workspacePath: '/workspace',
      copilotInstructionsGen: makeGen(),
    });

    const destinations = await adapter.resolveDestinations({
      customization: agentBoth,
      linkedRepos: repos,
    });

    expect(destinations).toEqual([
      {
        scope: 'personal',
        destination: '/Users/José Silva/.copilot/agents/triage.agent.md',
      },
      {
        scope: 'project',
        destination: '/Users/x/My Repo (work)/.github/agents/triage.agent.md',
      },
    ]);
  });
});
