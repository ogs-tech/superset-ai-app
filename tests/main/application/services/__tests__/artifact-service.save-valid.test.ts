import { describe, it, expect, vi } from 'vitest';
import { ArtifactService } from '../../../../../src/main/application/services/artifact-service.js';
import { SchemaValidator } from '../../../../../src/main/application/services/schema-validator.js';
import { InMemoryArtifactRepository } from '../../../../../src/main/infrastructure/artifact/in-memory-artifact-repository.js';
import { FixedClock } from '../../../../../src/main/infrastructure/clock/fixed-clock.js';
import type { AdapterManager } from '../../../../../src/main/application/services/adapter-manager.js';
import type { Artifact } from '../../../../../src/shared/artifact.js';

const validArtifact: Artifact = {
  id: 'skill/my-skill',
  frontmatter: {
    name: 'my-skill',
    type: 'skill',
    description: 'A valid skill',
    scopes: ['personal'],
    version: '1.0.0',
    createdAt: '2026-05-03T00:00:00.000Z',
    updatedAt: '2026-05-03T00:00:00.000Z',
  },
  body: '# My Skill',
};

const setup = () => {
  const repo = new InMemoryArtifactRepository();
  const clock = new FixedClock(new Date('2026-05-03T00:00:00.000Z'));
  const adapterManager = {
    syncOne: vi.fn().mockResolvedValue([]),
    syncAll: vi.fn().mockResolvedValue([]),
    removeOne: vi.fn().mockResolvedValue([]),
  } as unknown as AdapterManager;
  const schemaValidator = new SchemaValidator();
  const service = new ArtifactService(repo, clock, adapterManager, schemaValidator);
  return { repo, service };
};

describe('ArtifactService.save — SchemaValidator regression (AC#15)', () => {
  it('save(validArtifact) reaches repo.save and returns { artifact, syncReport }', async () => {
    const { service, repo } = setup();
    const saveSpy = vi.spyOn(repo, 'save');

    const result = await service.save({ artifact: validArtifact, isCreate: true });

    expect(saveSpy).toHaveBeenCalledOnce();
    expect(result.artifact).toBeDefined();
    expect(Array.isArray(result.syncReport)).toBe(true);
  });
});
