import { describe, it, expect, vi } from 'vitest';
import { CopilotInstructionsGen } from '../../../../../src/main/application/services/copilot-instructions-gen.js';
import { InMemoryArtifactRepository } from '../../../../../src/main/infrastructure/artifact/in-memory-artifact-repository.js';
import { InMemoryFileSystem } from '../../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';
import type { Artifact } from '../../../../../src/shared/artifact.js';

const WORKSPACE = '/workspace';

const makeRef = (id: string, name: string, flagged: boolean): Artifact => ({
  id,
  frontmatter: {
    name,
    type: 'reference',
    description: 'desc',
    scopes: ['personal'],
    version: '1.0.0',
    createdAt: '',
    updatedAt: '',
    ...(flagged ? { includeInCopilotInstructions: true } : {}),
  },
  body: `# ${name}`,
});

describe('CopilotInstructionsGen — filter (AC#2)', () => {
  it('counts only references with includeInCopilotInstructions === true', async () => {
    const artifactRepository = new InMemoryArtifactRepository();
    await artifactRepository.save({ artifact: makeRef('ref/a', 'alpha', true) });
    await artifactRepository.save({ artifact: makeRef('ref/b', 'beta', true) });
    await artifactRepository.save({ artifact: makeRef('ref/c', 'gamma', false) });

    const listSpy = vi.spyOn(artifactRepository, 'list');
    const workspaceFs = new InMemoryFileSystem();
    const gen = new CopilotInstructionsGen({ artifactRepository, workspaceFs, workspacePath: WORKSPACE });

    const result = await gen.generate();

    expect(result.refsIncluded).toBe(2);
    expect(listSpy).toHaveBeenCalledWith({ type: 'reference' });
  });
});
