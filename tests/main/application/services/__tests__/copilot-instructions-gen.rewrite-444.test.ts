import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { CopilotInstructionsGen } from '../../../../../src/main/application/services/copilot-instructions-gen.js';
import { InMemoryArtifactRepository } from '../../../../../src/main/infrastructure/artifact/in-memory-artifact-repository.js';
import { InMemoryFileSystem } from '../../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';
import type { Artifact } from '../../../../../src/shared/artifact.js';

const WORKSPACE = '/workspace';
const GENERATED_PATH = join(WORKSPACE, '_generated/copilot-instructions.md');

const makeRef = (id: string, name: string): Artifact => ({
  id,
  frontmatter: {
    name,
    type: 'reference',
    description: 'desc',
    scopes: ['personal'],
    version: '1.0.0',
    createdAt: '',
    updatedAt: '',
    includeInCopilotInstructions: true,
  },
  body: `# ${name}`,
});

describe('CopilotInstructionsGen — rewrite over 0o444 (AC#7)', () => {
  it('does not throw when destination already has 0o444 permissions', async () => {
    const artifactRepository = new InMemoryArtifactRepository();
    await artifactRepository.save({ artifact: makeRef('ref/a', 'alpha') });

    const workspaceFs = new InMemoryFileSystem();
    const gen = new CopilotInstructionsGen({ artifactRepository, workspaceFs, workspacePath: WORKSPACE });

    await gen.generate();
    await expect(gen.generate()).resolves.not.toThrow();

    const s = await workspaceFs.stat(GENERATED_PATH);
    expect(s!.mode & 0o777).toBe(0o444);
  });
});
