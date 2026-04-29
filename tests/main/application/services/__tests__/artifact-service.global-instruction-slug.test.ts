import { describe, expect, it, vi } from 'vitest';
import { ArtifactService } from '../../../../../src/main/application/services/artifact-service.js';
import { InMemoryArtifactRepository } from '../../../../../src/main/infrastructure/artifact/in-memory-artifact-repository.js';
import { FixedClock } from '../../../../../src/main/infrastructure/clock/fixed-clock.js';
import type { AdapterManager } from '../../../../../src/main/application/services/adapter-manager.js';
import type {
  Artifact,
  ArtifactFrontmatter,
} from '../../../../../src/shared/artifact.js';

const FROZEN = new Date('2026-04-26T10:00:00.000Z');

const globalInstructionFrontmatter = (
  overrides: Partial<ArtifactFrontmatter> = {},
): ArtifactFrontmatter => ({
  name: 'claude',
  type: 'global-instruction',
  description: 'global instruction file',
  scopes: ['personal'],
  version: '0.1.0',
  createdAt: '',
  updatedAt: '',
  ...overrides,
});

const makeArtifact = (overrides: Partial<ArtifactFrontmatter> = {}): Artifact => ({
  id: '',
  frontmatter: globalInstructionFrontmatter(overrides),
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

describe('ArtifactService.save — global-instruction slug enum (AC#2)', () => {
  it('rejects slug "foo" with reason: global-instruction-slug-not-allowed', async () => {
    const { service } = setup();
    const artifact = makeArtifact({ name: 'foo' });

    await expect(service.save({ artifact, isCreate: true })).rejects.toMatchObject({
      kind: 'validation',
      details: { reason: 'global-instruction-slug-not-allowed' },
    });
  });

  it('rejects slug "Claude" (case-sensitive) with reason: global-instruction-slug-not-allowed', async () => {
    const { service } = setup();
    const artifact = makeArtifact({ name: 'Claude' });

    await expect(service.save({ artifact, isCreate: true })).rejects.toMatchObject({
      kind: 'validation',
      details: { reason: 'global-instruction-slug-not-allowed' },
    });
  });

  it('rejects empty slug "" with reason: global-instruction-slug-not-allowed', async () => {
    const { service } = setup();
    const artifact = makeArtifact({ name: '' });

    await expect(service.save({ artifact, isCreate: true })).rejects.toMatchObject({
      kind: 'validation',
      details: { reason: 'global-instruction-slug-not-allowed' },
    });
  });

  it('accepts slug "claude"', async () => {
    const { service } = setup();
    const artifact = makeArtifact({ name: 'claude' });

    const result = await service.save({ artifact, isCreate: true });
    expect(result.artifact.frontmatter.name).toBe('claude');
  });

  it('accepts slug "copilot"', async () => {
    const { service } = setup();
    const artifact = makeArtifact({ name: 'copilot' });

    const result = await service.save({ artifact, isCreate: true });
    expect(result.artifact.frontmatter.name).toBe('copilot');
  });
});
