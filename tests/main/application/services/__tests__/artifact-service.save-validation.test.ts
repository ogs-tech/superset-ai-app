import { describe, it, expect, vi } from 'vitest';
import { ArtifactService } from '../../../../../src/main/application/services/artifact-service.js';
import { SchemaValidator } from '../../../../../src/main/application/services/schema-validator.js';
import { InMemoryArtifactRepository } from '../../../../../src/main/infrastructure/artifact/in-memory-artifact-repository.js';
import { FixedClock } from '../../../../../src/main/infrastructure/clock/fixed-clock.js';
import type { AdapterManager } from '../../../../../src/main/application/services/adapter-manager.js';
import type { Artifact } from '../../../../../src/shared/artifact.js';

const invalidArtifact: Artifact = {
  id: 'skill/Invalid Name',
  frontmatter: {
    name: 'Invalid Name',
    type: 'skill',
    description: '',
    scopes: [],
    version: 'bad',
    createdAt: 'not-a-date',
    updatedAt: 'not-a-date',
  },
  body: '# Invalid',
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
  return { repo, service, adapterManager };
};

describe('ArtifactService.save — SchemaValidator integration (AC#14)', () => {
  it('save(invalidArtifact) throws DomainError({ kind: "validation", details: { errors } })', async () => {
    const { service } = setup();

    await expect(service.save({ artifact: invalidArtifact })).rejects.toMatchObject({
      kind: 'validation',
      details: { errors: expect.arrayContaining([expect.objectContaining({ path: expect.any(String), kind: expect.any(String), message: expect.any(String) })]) },
    });
  });

  it('repo.save is NOT called when validation fails', async () => {
    const { service, repo } = setup();
    const saveSpy = vi.spyOn(repo, 'save');

    await expect(service.save({ artifact: invalidArtifact })).rejects.toBeDefined();

    expect(saveSpy).not.toHaveBeenCalled();
  });
});
