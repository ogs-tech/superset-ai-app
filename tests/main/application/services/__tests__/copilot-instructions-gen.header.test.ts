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
  },
  body: `body of ${name}`,
});

describe('CopilotInstructionsGen — header (AC#3)', () => {
  it('generated file starts exactly with the GENERATED header', async () => {
    const artifactRepository = new InMemoryArtifactRepository();
    await artifactRepository.save({ artifact: makeRef('ref/a', 'alpha') });

    const workspaceFs = new InMemoryFileSystem();
    const gen = new CopilotInstructionsGen({ artifactRepository, workspaceFs, workspacePath: WORKSPACE });

    await gen.generate();

    const content = await workspaceFs.readFile(GENERATED_PATH);
    expect(content).toMatch(/^<!-- GENERATED — edit references in the app -->\n\n/);
  });
});
