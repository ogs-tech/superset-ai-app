import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import type { Customization, CustomizationType } from '../../../../../src/shared/customization.js';
import { HOMEDIR, makeAdapter } from './copilot-adapter.helpers.js';

const buildCustomization = (
  type: CustomizationType,
  name: string,
  scopes: Array<'personal' | 'project'> = ['personal'],
): Customization => ({
  id: `${type}/${name}`,
  frontmatter: {
    name,
    type,
    description: 'desc',
    scopes,
    version: '0.1.0',
    createdAt: '',
    updatedAt: '',
  },
  body: `# ${name}\n`,
});

describe('CopilotAdapter — global-instruction routing', () => {
  it('resolves to <homedir>/.copilot/instructions/global.instructions.md', async () => {
    const adapter = makeAdapter();
    const destinations = await adapter.resolveDestinations({
      customization: buildCustomization('global-instruction', 'default'),
      linkedRepos: [],
    });

    expect(destinations).toEqual([
      {
        scope: 'personal',
        destination: join(HOMEDIR, '.copilot/instructions/global.instructions.md'),
      },
    ]);
  });

  it('all returned destinations are absolute', async () => {
    const adapter = makeAdapter();
    const destinations = await adapter.resolveDestinations({
      customization: buildCustomization('global-instruction', 'default'),
      linkedRepos: [],
    });

    for (const d of destinations) {
      expect(d.destination.startsWith('/')).toBe(true);
    }
  });
});
