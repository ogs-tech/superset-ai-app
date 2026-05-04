import { describe, expect, it } from 'vitest';
import type { Artifact, ArtifactScope } from '../../../../../src/shared/artifact.js';
import type { LinkedRepo } from '../../../../../src/shared/settings.js';
import { makeAdapter, makeGen } from './copilot-adapter.helpers.js';

const reference = (scopes: ArtifactScope[]): Artifact => ({
  id: 'reference/style-guide',
  frontmatter: {
    name: 'style-guide',
    type: 'reference',
    description: 'desc',
    scopes,
    version: '1.0.0',
    createdAt: '',
    updatedAt: '',
  },
  body: '# style',
});

const repos: LinkedRepo[] = [
  { id: 'r1', name: 'r1', path: '/r1' },
  { id: 'r2', name: 'r2', path: '/r2' },
];

describe('CopilotAdapter — reference returns [] when 0 refs flagged (AC#13)', () => {
  it.each<[ArtifactScope[], LinkedRepo[]]>([
    [['personal'], []],
    [['personal'], repos],
    [['project'], []],
    [['project'], repos],
    [['personal', 'project'], []],
    [['personal', 'project'], repos],
  ])(
    'returns [] for reference (scopes=%j, linkedRepos.length=%i)',
    async (scopes, linkedRepos) => {
      const gen = makeGen({ refsIncluded: 0 });
      const adapter = makeAdapter(gen);

      const destinations = await adapter.resolveDestinations({
        artifact: reference(scopes),
        linkedRepos,
      });

      expect(destinations).toEqual([]);
    },
  );
});
