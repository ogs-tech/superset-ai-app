import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import type { Customization } from '../../../../../src/shared/customization.js';
import type { LinkedRepo } from '../../../../../src/shared/settings.js';
import { HOMEDIR, makeAdapter } from './copilot-adapter.helpers.js';

const skillMultiScope: Customization = {
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
  it('returns the union of personal + project destinations when both scopes are set', async () => {
    const adapter = makeAdapter();

    const destinations = await adapter.resolveDestinations({
      customization: skillMultiScope,
      linkedRepos: oneRepo,
    });

    expect(destinations).toEqual([
      { scope: 'personal', destination: join(HOMEDIR, '.copilot/skills', 'review') },
      { scope: 'project', destination: join('/r1', '.github/skills', 'review') },
    ]);
  });

  it('returns only the personal destination when scopes include "project" but linkedRepos is empty', async () => {
    const adapter = makeAdapter();

    const destinations = await adapter.resolveDestinations({
      customization: skillMultiScope,
      linkedRepos: [],
    });

    expect(destinations).toEqual([
      { scope: 'personal', destination: join(HOMEDIR, '.copilot/skills', 'review') },
    ]);
  });
});
