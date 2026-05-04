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

describe('CopilotAdapter — reference zero refs (AC#9, AC#13)', () => {
  it('returns [] when generate() reports refsIncluded === 0', async () => {
    const gen: CopilotInstructionsGenPort = {
      generate: vi.fn().mockResolvedValue({ path: GENERATED_PATH, refsIncluded: 0 }),
    };

    const adapter = new CopilotAdapter({ homedir: HOMEDIR, workspacePath: WORKSPACE, copilotInstructionsGen: gen });

    const destinations = await adapter.resolveDestinations({
      artifact: referencePersonal,
      linkedRepos: [],
    });

    expect(destinations).toHaveLength(0);
  });
});
