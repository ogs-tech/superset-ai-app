import { describe, it, expect, vi } from 'vitest';
import { join } from 'node:path';
import { CopilotAdapter } from '../../../../../src/main/infrastructure/adapters/copilot-adapter.js';
import type { Artifact } from '../../../../../src/shared/artifact.js';
import type { CopilotInstructionsGenPort } from '../../../../../src/main/application/ports/copilot-instructions-gen.js';

const HOMEDIR = '/home/alice';
const WORKSPACE = '/workspace';
const GENERATED_PATH = join(WORKSPACE, '_generated/copilot-instructions.md');

const referencePersonal: Artifact = {
  id: 'reference/my-ref',
  frontmatter: {
    name: 'my-ref',
    type: 'reference',
    description: 'desc',
    scopes: ['personal'],
    version: '1.0.0',
    createdAt: '',
    updatedAt: '',
    includeInCopilotInstructions: true,
  },
  body: '# My reference',
};

describe('CopilotAdapter — reference + personal (AC#9a, 9b, 9d)', () => {
  it('returns 1 personal destination pointing to the generated file', async () => {
    const gen: CopilotInstructionsGenPort = {
      generate: vi.fn().mockResolvedValue({ path: GENERATED_PATH, refsIncluded: 1 }),
    };

    const adapter = new CopilotAdapter({ homedir: HOMEDIR, workspacePath: WORKSPACE, copilotInstructionsGen: gen });

    const destinations = await adapter.resolveDestinations({
      artifact: referencePersonal,
      linkedRepos: [],
    });

    expect(destinations).toHaveLength(1);
    expect(destinations[0]).toMatchObject({
      scope: 'personal',
      destination: join(HOMEDIR, '.copilot/instructions/copilot-instructions.md'),
    });
    expect(gen.generate).toHaveBeenCalledOnce();
  });
});
