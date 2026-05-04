import { vi } from 'vitest';
import { CopilotAdapter } from '../../../../../src/main/infrastructure/adapters/copilot-adapter.js';
import type { CopilotInstructionsGenPort, GenerateResult } from '../../../../../src/main/application/ports/copilot-instructions-gen.js';

export const HOMEDIR = '/Users/alice';
export const WORKSPACE = '/workspace';

export const makeGen = (result: Partial<GenerateResult> = {}): CopilotInstructionsGenPort => ({
  generate: vi.fn().mockResolvedValue({
    path: `${WORKSPACE}/_generated/copilot-instructions.md`,
    refsIncluded: 1,
    ...result,
  }),
});

export const makeAdapter = (gen?: CopilotInstructionsGenPort): CopilotAdapter =>
  new CopilotAdapter({
    homedir: HOMEDIR,
    workspacePath: WORKSPACE,
    copilotInstructionsGen: gen ?? makeGen(),
  });
