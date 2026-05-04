import { describe, expect, it, vi } from 'vitest';
import { ArtifactService } from '../../../../../src/main/application/services/artifact-service.js';
import { InMemoryArtifactRepository } from '../../../../../src/main/infrastructure/artifact/in-memory-artifact-repository.js';
import { FixedClock } from '../../../../../src/main/infrastructure/clock/fixed-clock.js';
import type { AdapterManager } from '../../../../../src/main/application/services/adapter-manager.js';
import type {
  Artifact,
  ArtifactFrontmatter,
  ArtifactScope,
} from '../../../../../src/shared/artifact.js';

const FROZEN = new Date('2026-04-26T10:00:00.000Z');

const globalInstructionFrontmatter = (
  overrides: Partial<ArtifactFrontmatter> = {},
): ArtifactFrontmatter => ({
  name: 'default',
  type: 'global-instruction',
  description: 'global instruction file',
  scopes: ['personal'],
  version: '0.1.0',
  createdAt: '',
  updatedAt: '',
  ...overrides,
});

const makeArtifact = (scopes: ArtifactScope[]): Artifact => ({
  id: '',
  frontmatter: globalInstructionFrontmatter({ scopes }),
  body: '# global instruction\n',
});

const setup = () => {
  const repo = new InMemoryArtifactRepository();
  const clock = new FixedClock(FROZEN);
  const adapterManager = {
    syncOne: vi.fn().mockResolvedValue([]),
    syncAll: vi.fn().mockResolvedValue([]),
    removeOne: vi.fn().mockResolvedValue([]),
  } as unknown as AdapterManager;
  const service = new ArtifactService(repo, clock, adapterManager);
  return { service };
};

describe('ArtifactService.save — global-instruction scope enforcement (AC#3)', () => {
  it('rejects scopes ["project"] with reason: global-instruction-scope-must-be-personal', async () => {
    const { service } = setup();
    const artifact = makeArtifact(['project']);

    await expect(service.save({ artifact, isCreate: true })).rejects.toMatchObject({
      kind: 'validation',
      details: { reason: 'global-instruction-scope-must-be-personal' },
    });
  });

  it('rejects scopes ["personal", "project"] with reason: global-instruction-scope-must-be-personal', async () => {
    const { service } = setup();
    const artifact = makeArtifact(['personal', 'project']);

    await expect(service.save({ artifact, isCreate: true })).rejects.toMatchObject({
      kind: 'validation',
      details: { reason: 'global-instruction-scope-must-be-personal' },
    });
  });

  it('rejects empty scopes [] with reason: global-instruction-scope-must-be-personal', async () => {
    const { service } = setup();
    const artifact = makeArtifact([]);

    await expect(service.save({ artifact, isCreate: true })).rejects.toMatchObject({
      kind: 'validation',
      details: { reason: 'global-instruction-scope-must-be-personal' },
    });
  });

  it('accepts scopes ["personal"]', async () => {
    const { service } = setup();
    const artifact = makeArtifact(['personal']);

    const result = await service.save({ artifact, isCreate: true });
    expect(result.artifact.frontmatter.scopes).toEqual(['personal']);
  });
});
