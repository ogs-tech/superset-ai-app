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

describe('CopilotInstructionsGen — zero refs', () => {
  it('returns { refsIncluded: 0 } and removes existing generated file when last reference is deleted', async () => {
    const customizationRepository = new InMemoryCustomizationRepository();
    await customizationRepository.save({ customization: makeRef('ref/a', 'alpha') });

    const workspaceFs = new InMemoryFileSystem();
    const gen = new CopilotInstructionsGen({ customizationRepository, workspaceFs, workspacePath: WORKSPACE });

    await gen.generate();
    expect(await workspaceFs.stat(GENERATED_PATH)).not.toBeNull();

    await customizationRepository.delete({ id: 'ref/a' });

    const result = await gen.generate();

    expect(result.refsIncluded).toBe(0);
    const entry = await workspaceFs.lstat(GENERATED_PATH);
    expect(entry.kind).toBe('none');
  });

  it('returns { refsIncluded: 0 } without error even if no generated file exists', async () => {
    const customizationRepository = new InMemoryCustomizationRepository();
    const workspaceFs = new InMemoryFileSystem();
    const gen = new CopilotInstructionsGen({ customizationRepository, workspaceFs, workspacePath: WORKSPACE });

    const result = await gen.generate();
    expect(result.refsIncluded).toBe(0);
  });
});
