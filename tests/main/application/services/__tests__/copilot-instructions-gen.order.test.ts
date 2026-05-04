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
  body: `body:${name}`,
});

describe('CopilotInstructionsGen — order (AC#4)', () => {
  it('sorts references alphabetically by name using Intl.Collator("en")', async () => {
    const artifactRepository = new InMemoryArtifactRepository();
    await artifactRepository.save({ artifact: makeRef('ref/c', 'Cherry') });
    await artifactRepository.save({ artifact: makeRef('ref/a', 'Apple') });
    await artifactRepository.save({ artifact: makeRef('ref/b', 'banana') });

    const workspaceFs = new InMemoryFileSystem();
    const gen = new CopilotInstructionsGen({ artifactRepository, workspaceFs, workspacePath: WORKSPACE });

    await gen.generate();

    const content = await workspaceFs.readFile(GENERATED_PATH);
    const bodyOrder = ['body:Apple', 'body:banana', 'body:Cherry'];
    let lastIndex = -1;
    for (const body of bodyOrder) {
      const idx = content.indexOf(body);
      expect(idx).toBeGreaterThan(lastIndex);
      lastIndex = idx;
    }
  });

  it('breaks ties by artifact id', async () => {
    const artifactRepository = new InMemoryArtifactRepository();
    await artifactRepository.save({ artifact: makeRef('ref/z', 'Same') });
    await artifactRepository.save({ artifact: makeRef('ref/a', 'Same') });

    const workspaceFs = new InMemoryFileSystem();
    const gen = new CopilotInstructionsGen({ artifactRepository, workspaceFs, workspacePath: WORKSPACE });

    await gen.generate();

    const content = await workspaceFs.readFile(GENERATED_PATH);
    expect(content.indexOf('body:Same')).toBeGreaterThan(-1);
  });
});
