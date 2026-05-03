import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { CopilotAdapter } from '../../../../../src/main/infrastructure/adapters/copilot-adapter.js';
import type { Artifact } from '../../../../../src/shared/artifact.js';
import type { LinkedRepo } from '../../../../../src/shared/settings.js';

const HOMEDIR = '/Users/alice';

const skillMultiScope: Artifact = {
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

const oneRepo: LinkedRepo[] = [{ id: 'r1', name: 'r1', path: '/r1' }];

describe('CopilotAdapter — skill + multi-scope (AC#2, AC#3, AC#7)', () => {
  it('returns the union of personal + project destinations when both scopes are set', () => {
    const adapter = new CopilotAdapter({ homedir: HOMEDIR });

    const destinations = adapter.resolveDestinations({
      artifact: skillMultiScope,
      linkedRepos: oneRepo,
    });

    expect(destinations).toEqual([
      { scope: 'personal', destination: join(HOMEDIR, '.copilot/skills', 'review') },
      { scope: 'project', destination: join('/r1', '.github/skills', 'review') },
    ]);
  });

  it('returns only the personal destination when scopes include "project" but linkedRepos is empty', () => {
    const adapter = new CopilotAdapter({ homedir: HOMEDIR });

    const destinations = adapter.resolveDestinations({
      artifact: skillMultiScope,
      linkedRepos: [],
    });

    expect(destinations).toEqual([
      { scope: 'personal', destination: join(HOMEDIR, '.copilot/skills', 'review') },
    ]);
  });
});
