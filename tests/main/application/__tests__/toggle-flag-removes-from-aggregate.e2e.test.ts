import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { CopilotInstructionsGen } from '../../../../src/main/application/services/copilot-instructions-gen.js';
import { InMemoryArtifactRepository } from '../../../../src/main/infrastructure/artifact/in-memory-artifact-repository.js';
import { InMemoryFileSystem } from '../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';
import type { Artifact } from '../../../../src/shared/artifact.js';

const WORKSPACE = '/workspace';
const GENERATED = join(WORKSPACE, '_generated/copilot-instructions.md');

const makeRef = (flagged: boolean): Artifact => ({
  id: 'reference/guide',
  frontmatter: {
    name: 'guide',
    type: 'reference',
    description: 'desc',
    scopes: ['personal'],
    version: '1.0.0',
    createdAt: '',
    updatedAt: '',
    ...(flagged ? { includeInCopilotInstructions: true } : {}),
  },
  body: '# My Guide',
});

const setup = () => {
  const artifactRepo = new InMemoryArtifactRepository();
  const fs = new InMemoryFileSystem();
  fs.createFile(join(WORKSPACE, 'references/guide.md'), '# My Guide');
  const gen = new CopilotInstructionsGen({ artifactRepository: artifactRepo, workspaceFs: fs, workspacePath: WORKSPACE });
  return { artifactRepo, fs, gen };
};

describe('toggle-flag-removes-from-aggregate e2e (AC#12)', () => {
  it('disabling flag removes content from aggregate on next generate', async () => {
    const { artifactRepo, fs, gen } = setup();

    await artifactRepo.save({ artifact: makeRef(true) });
    const r1 = await gen.generate();
    expect(r1.refsIncluded).toBe(1);
    expect(await fs.readFile(GENERATED)).toContain('# My Guide');

    await artifactRepo.save({ artifact: makeRef(false) });
    const r2 = await gen.generate();
    expect(r2.refsIncluded).toBe(0);

    const entry = await fs.lstat(GENERATED);
    expect(entry.kind).toBe('none');
  });
});
