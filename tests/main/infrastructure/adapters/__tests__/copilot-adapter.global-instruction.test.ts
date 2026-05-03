import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { CopilotAdapter } from '../../../../../src/main/infrastructure/adapters/copilot-adapter.js';
import type { Artifact, ArtifactType } from '../../../../../src/shared/artifact.js';

const HOMEDIR = '/Users/alice';

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
  it('resolves slug "copilot" to <homedir>/.copilot/instructions/global.instructions.md (AC#9)', () => {
    const adapter = new CopilotAdapter({ homedir: HOMEDIR });
    const destinations = adapter.resolveDestinations({
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

  it('returns [] for global-instruction + slug "claude" (AC#10)', () => {
    const adapter = new CopilotAdapter({ homedir: HOMEDIR });
    const destinations = adapter.resolveDestinations({
      artifact: buildArtifact('global-instruction', 'claude'),
      linkedRepos: [],
    });

    expect(destinations).toEqual([]);
  });

  // NOTE: 014's stub-era assertions for `skill` and `agent` returning [] were
  // removed when 007 expanded those branches to produce real destinations
  // (see AC#2-5). Coverage now lives in copilot-adapter.{skill,agent}-*.test.ts.

  it('returns [] for type "reference" (AC#10)', () => {
    const adapter = new CopilotAdapter({ homedir: HOMEDIR });
    const destinations = adapter.resolveDestinations({
      artifact: buildArtifact('reference', 'glossary'),
      linkedRepos: [],
    });

    expect(destinations).toEqual([]);
  });

  it('all returned destinations are absolute (AC#16)', () => {
    const adapter = new CopilotAdapter({ homedir: HOMEDIR });
    const destinations = adapter.resolveDestinations({
      artifact: buildArtifact('global-instruction', 'copilot'),
      linkedRepos: [],
    });

    for (const d of destinations) {
      expect(d.destination.startsWith('/')).toBe(true);
    }
  });
});
