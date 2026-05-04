import { describe, it, expect } from 'vitest';
import { CopilotInstructionsGen } from '../../../../../src/main/application/services/copilot-instructions-gen.js';
import { InMemoryCustomizationRepository } from '../../../../../src/main/infrastructure/customization/in-memory-customization-repository.js';
import { InMemoryFileSystem } from '../../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';

const WORKSPACE = '/workspace';

describe('CopilotInstructionsGen — contract (AC#1)', () => {
  it('generate() resolves with { path: string, refsIncluded: number }', async () => {
    const customizationRepo = new InMemoryCustomizationRepository();
    const workspaceFs = new InMemoryFileSystem();
    const gen = new CopilotInstructionsGen({ customizationRepository: customizationRepo, workspaceFs, workspacePath: WORKSPACE });

    const result = await gen.generate();

    expect(typeof result.path).toBe('string');
    expect(typeof result.refsIncluded).toBe('number');
  });
});
