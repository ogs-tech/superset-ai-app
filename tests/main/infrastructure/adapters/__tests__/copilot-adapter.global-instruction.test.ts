import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import type { Artifact, ArtifactType } from '../../../../../src/shared/artifact.js';
import { HOMEDIR, makeAdapter } from './copilot-adapter.helpers.js';

const buildArtifact = (
  type: ArtifactType,
  name: string,
  scopes: Array<'personal' | 'project'> = ['personal'],
): Artifact => ({
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

describe('CopilotAdapter — global-instruction routing (AC#9, AC#10, AC#16)', () => {
  it('resolves slug "copilot" to <homedir>/.copilot/instructions/global.instructions.md (AC#9)', async () => {
    const adapter = makeAdapter();
    const destinations = await adapter.resolveDestinations({
      artifact: buildArtifact('global-instruction', 'copilot'),
      linkedRepos: [],
    });

    expect(destinations).toEqual([
      {
        scope: 'personal',
        destination: join(HOMEDIR, '.copilot/instructions/global.instructions.md'),
      },
    ]);
  });

  it('returns [] for global-instruction + slug "claude" (AC#10)', async () => {
    const adapter = makeAdapter();
    const destinations = await adapter.resolveDestinations({
      artifact: buildArtifact('global-instruction', 'claude'),
      linkedRepos: [],
    });

    expect(destinations).toEqual([]);
  });

  it('all returned destinations are absolute (AC#16)', async () => {
    const adapter = makeAdapter();
    const destinations = await adapter.resolveDestinations({
      artifact: buildArtifact('global-instruction', 'copilot'),
      linkedRepos: [],
    });

    for (const d of destinations) {
      expect(d.destination.startsWith('/')).toBe(true);
    }
  });
});
