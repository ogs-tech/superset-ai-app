import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { CopilotInstructionsGen } from '../../../../../src/main/application/services/copilot-instructions-gen.js';
import { InMemoryCustomizationRepository } from '../../../../../src/main/infrastructure/customization/in-memory-customization-repository.js';
import { InMemoryFileSystem } from '../../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';
import type { Customization } from '../../../../../src/shared/customization.js';

const WORKSPACE = '/workspace';
const GENERATED_PATH = join(WORKSPACE, '_generated/copilot-instructions.md');

const makeRef = (id: string, name: string): Customization => ({
  id,
  frontmatter: {
    name,
    type: 'reference',
    description: 'desc',
    scopes: ['personal'],
    version: '1.0.0',
    createdAt: '',
    updatedAt: '',
  },
  body: `# ${name}`,
});

describe('CopilotInstructionsGen — idempotent (AC#6)', () => {
  it('two consecutive generate() calls with same input produce identical bytes', async () => {
    const customizationRepository = new InMemoryCustomizationRepository();
    await customizationRepository.save({ customization: makeRef('ref/a', 'alpha') });

    const workspaceFs = new InMemoryFileSystem();
    const gen = new CopilotInstructionsGen({ customizationRepository, workspaceFs, workspacePath: WORKSPACE });

    await gen.generate();
    const first = await workspaceFs.readFile(GENERATED_PATH);

    await gen.generate();
    const second = await workspaceFs.readFile(GENERATED_PATH);

    expect(first).toBe(second);
  });
});
