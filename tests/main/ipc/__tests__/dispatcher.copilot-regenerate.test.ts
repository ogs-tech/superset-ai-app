import { describe, expect, it, vi } from 'vitest';
import { buildHandlers, type IpcDeps } from '../../../../src/main/ipc/registry.js';
import { createDispatcher } from '../../../../src/main/ipc/dispatcher.js';
import type { CopilotInstructionsGenPort, GenerateResult } from '../../../../src/main/application/ports/copilot-instructions-gen.js';

const GENERATED_PATH = '/workspace/_generated/copilot-instructions.md';

const stubResult: GenerateResult = { path: GENERATED_PATH, refsIncluded: 2 };

const buildDeps = (generate: () => Promise<GenerateResult>): IpcDeps => {
  const copilotInstructionsGen: CopilotInstructionsGenPort = { generate };
  return {
    copilotInstructionsGen,
  } as unknown as IpcDeps;
};

describe('IPC copilot.regenerateInstructions (T028 — AC#14)', () => {
  it('delegates to CopilotInstructionsGen.generate() and returns { path, refsIncluded }', async () => {
    const generate = vi.fn<() => Promise<GenerateResult>>().mockResolvedValue(stubResult);
    const handlers = buildHandlers(buildDeps(generate));
    const dispatch = createDispatcher(handlers);

    const result = await dispatch('copilot.regenerateInstructions', {});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual(stubResult);
    expect(generate).toHaveBeenCalledOnce();
  });
});
