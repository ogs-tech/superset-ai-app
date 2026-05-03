import { describe, expect, it } from 'vitest';
import { isAbsolute, join } from 'node:path';
import { CopilotAdapter } from '../../../../../src/main/infrastructure/adapters/copilot-adapter.js';
import type { Artifact } from '../../../../../src/shared/artifact.js';

const HOMEDIR = '/Users/alice';

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

describe('CopilotAdapter — skill + personal (AC#2, AC#8)', () => {
  it('returns exactly one destination under <homedir>/.copilot/skills/<slug>', () => {
    const adapter = new CopilotAdapter({ homedir: HOMEDIR });

    const destinations = adapter.resolveDestinations({
      artifact: skillPersonal,
      linkedRepos: [],
    });

    expect(destinations).toEqual([
      { scope: 'personal', destination: join(HOMEDIR, '.copilot/skills', 'review') },
    ]);
  });

  it('returns an absolute destination', () => {
    const adapter = new CopilotAdapter({ homedir: HOMEDIR });

    const [destination] = adapter.resolveDestinations({
      artifact: skillPersonal,
      linkedRepos: [],
    });

    expect(destination?.destination).toBeDefined();
    expect(isAbsolute(destination!.destination)).toBe(true);
  });
});
