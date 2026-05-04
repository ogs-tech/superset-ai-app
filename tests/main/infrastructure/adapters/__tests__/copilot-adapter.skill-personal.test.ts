import { describe, expect, it } from 'vitest';
import { isAbsolute, join } from 'node:path';
import type { Customization } from '../../../../../src/shared/customization.js';
import { HOMEDIR, makeAdapter } from './copilot-adapter.helpers.js';

const skillPersonal: Customization = {
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
  it('returns exactly one destination under <homedir>/.copilot/skills/<slug>', async () => {
    const adapter = makeAdapter();

    const destinations = await adapter.resolveDestinations({
      customization: skillPersonal,
      linkedRepos: [],
    });

    expect(destinations).toEqual([
      { scope: 'personal', destination: join(HOMEDIR, '.copilot/skills', 'review') },
    ]);
  });

  it('returns an absolute destination', async () => {
    const adapter = makeAdapter();

    const destinations = await adapter.resolveDestinations({
      customization: skillPersonal,
      linkedRepos: [],
    });

    const [destination] = destinations;
    expect(destination?.destination).toBeDefined();
    expect(isAbsolute(destination!.destination)).toBe(true);
  });
});
