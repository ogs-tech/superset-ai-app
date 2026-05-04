import { describe, it, expect, vi } from 'vitest';
import { join } from 'node:path';
import { CopilotAdapter } from '../../../../../src/main/infrastructure/adapters/copilot-adapter.js';
import type { Customization } from '../../../../../src/shared/customization.js';
import type { CopilotInstructionsGenPort } from '../../../../../src/main/application/ports/copilot-instructions-gen.js';

const HOMEDIR = '/home/alice';
const WORKSPACE = '/workspace';
const GENERATED_PATH = join(WORKSPACE, '_generated/copilot-instructions.md');

const referencePersonal: Customization = {
  id: 'reference/my-ref',
  frontmatter: {
    name: 'my-ref',
    type: 'reference',
    description: 'desc',
    scopes: ['personal'],
    version: '1.0.0',
    createdAt: '',
    updatedAt: '',
  },
  body: '# My reference',
};

describe('CopilotAdapter — reference cold start (AC#9a)', () => {
  it('calls generate() before returning destinations', async () => {
    const gen: CopilotInstructionsGenPort = {
      generate: vi.fn().mockResolvedValue({ path: GENERATED_PATH, refsIncluded: 1 }),
    };

    const adapter = new CopilotAdapter({ homedir: HOMEDIR, workspacePath: WORKSPACE, copilotInstructionsGen: gen });

    await adapter.resolveDestinations({
      customization: referencePersonal,
      linkedRepos: [],
    });

    expect(gen.generate).toHaveBeenCalledOnce();
  });
});
