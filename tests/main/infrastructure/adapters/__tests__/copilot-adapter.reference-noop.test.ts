import { describe, expect, it } from 'vitest';
import { CopilotAdapter } from '../../../../../src/main/infrastructure/adapters/copilot-adapter.js';
import type { Artifact, ArtifactScope } from '../../../../../src/shared/artifact.js';
import type { LinkedRepo } from '../../../../../src/shared/settings.js';

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

describe('CopilotAdapter — reference (no-op)', () => {
  it.each<[ArtifactScope[], LinkedRepo[]]>([
    [['personal'], []],
    [['personal'], repos],
    [['project'], []],
    [['project'], repos],
    [['personal', 'project'], []],
    [['personal', 'project'], repos],
  ])(
    'returns [] for reference (scopes=%j, linkedRepos.length=%i)',
    (scopes, linkedRepos) => {
      const adapter = new CopilotAdapter({ homedir: '/Users/alice' });

      const destinations = adapter.resolveDestinations({
        artifact: reference(scopes),
        linkedRepos,
      });

      expect(destinations).toEqual([]);
    },
  );
});
