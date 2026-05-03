import { describe, expect, it } from 'vitest';
import { isAbsolute, join } from 'node:path';
import { CopilotAdapter } from '../../../../../src/main/infrastructure/adapters/copilot-adapter.js';
import type { Artifact } from '../../../../../src/shared/artifact.js';
import type { LinkedRepo } from '../../../../../src/shared/settings.js';

const HOMEDIR = '/Users/alice';

const skillProject: Artifact = {
  id: 'skill/review',
  frontmatter: {
    name: 'review',
    type: 'skill',
    description: 'desc',
    scopes: ['project'],
    version: '1.0.0',
    createdAt: '',
    updatedAt: '',
  },
  body: '# review',
};

const repos: LinkedRepo[] = [
  { id: 'r1', name: 'r1', path: '/r1' },
  { id: 'r2', name: 'r2', path: '/r2' },
];

describe('CopilotAdapter — skill + project (AC#3, AC#7, AC#8)', () => {
  it('returns one destination per linkedRepo under <repo>/.github/skills/<slug>', () => {
    const adapter = new CopilotAdapter({ homedir: HOMEDIR });

    const destinations = adapter.resolveDestinations({
      artifact: skillProject,
      linkedRepos: repos,
    });

    expect(destinations).toEqual([
      { scope: 'project', destination: join('/r1', '.github/skills', 'review') },
      { scope: 'project', destination: join('/r2', '.github/skills', 'review') },
    ]);
  });

  it('returns absolute destinations', () => {
    const adapter = new CopilotAdapter({ homedir: HOMEDIR });

    const destinations = adapter.resolveDestinations({
      artifact: skillProject,
      linkedRepos: repos,
    });

    for (const d of destinations) {
      expect(isAbsolute(d.destination)).toBe(true);
    }
  });

  it('returns [] when scope is project and linkedRepos is empty', () => {
    const adapter = new CopilotAdapter({ homedir: HOMEDIR });

    const destinations = adapter.resolveDestinations({
      artifact: skillProject,
      linkedRepos: [],
    });

    expect(destinations).toEqual([]);
  });
});
