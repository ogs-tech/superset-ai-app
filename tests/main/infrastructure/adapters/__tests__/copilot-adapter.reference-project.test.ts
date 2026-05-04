import { describe, it, expect, vi } from 'vitest';
import { join } from 'node:path';
import { CopilotAdapter } from '../../../../../src/main/infrastructure/adapters/copilot-adapter.js';
import type { Artifact } from '../../../../../src/shared/artifact.js';
import type { LinkedRepo } from '../../../../../src/shared/settings.js';
import type { CopilotInstructionsGenPort } from '../../../../../src/main/application/ports/copilot-instructions-gen.js';

const HOMEDIR = '/home/alice';
const WORKSPACE = '/workspace';
const GENERATED_PATH = join(WORKSPACE, '_generated/copilot-instructions.md');

const referenceProject: Artifact = {
  id: 'reference/my-ref',
  frontmatter: {
    name: 'my-ref',
    type: 'reference',
    description: 'desc',
    scopes: ['project'],
    version: '1.0.0',
    createdAt: '',
    updatedAt: '',
    includeInCopilotInstructions: true,
  },
  body: '# My reference',
};

const linkedRepos: LinkedRepo[] = [
  { id: 'r1', name: 'repo1', path: '/repos/repo1' },
  { id: 'r2', name: 'repo2', path: '/repos/repo2' },
];

describe('CopilotAdapter — reference + project (AC#9c)', () => {
  it('returns N project destinations for N linked repos', async () => {
    const gen: CopilotInstructionsGenPort = {
      generate: vi.fn().mockResolvedValue({ path: GENERATED_PATH, refsIncluded: 1 }),
    };

    const adapter = new CopilotAdapter({ homedir: HOMEDIR, workspacePath: WORKSPACE, copilotInstructionsGen: gen });

    const destinations = await adapter.resolveDestinations({
      artifact: referenceProject,
      linkedRepos,
    });

    expect(destinations).toHaveLength(2);
    expect(destinations[0]).toMatchObject({
      scope: 'project',
      destination: join('/repos/repo1', '.github/copilot-instructions.md'),
    });
    expect(destinations[1]).toMatchObject({
      scope: 'project',
      destination: join('/repos/repo2', '.github/copilot-instructions.md'),
    });
  });
});
