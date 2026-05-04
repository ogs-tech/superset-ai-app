import { describe, expect, it } from 'vitest';
import { isAbsolute, join } from 'node:path';
import type { Customization } from '../../../../../src/shared/customization.js';
import type { LinkedRepo } from '../../../../../src/shared/settings.js';
import { makeAdapter } from './copilot-adapter.helpers.js';

const skillProject: Customization = {
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
  it('returns one destination per linkedRepo under <repo>/.github/skills/<slug>', async () => {
    const adapter = makeAdapter();

    const destinations = await adapter.resolveDestinations({
      customization: skillProject,
      linkedRepos: repos,
    });

    expect(destinations).toEqual([
      { scope: 'project', destination: join('/r1', '.github/skills', 'review') },
      { scope: 'project', destination: join('/r2', '.github/skills', 'review') },
    ]);
  });

  it('returns absolute destinations', async () => {
    const adapter = makeAdapter();

    const destinations = await adapter.resolveDestinations({
      customization: skillProject,
      linkedRepos: repos,
    });

    for (const d of destinations) {
      expect(isAbsolute(d.destination)).toBe(true);
    }
  });

  it('returns [] when scope is project and linkedRepos is empty', async () => {
    const adapter = makeAdapter();

    const destinations = await adapter.resolveDestinations({
      customization: skillProject,
      linkedRepos: [],
    });

    expect(destinations).toEqual([]);
  });
});
