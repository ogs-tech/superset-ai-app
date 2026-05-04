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

  it('accepts empty createdAt/updatedAt on create (service stamps them) when SchemaValidator is wired', async () => {
    const { service } = setup();
    const fresh: Artifact = {
      id: '',
      frontmatter: {
        name: 'default',
        type: 'global-instruction',
        description: 'unified global instructions',
        scopes: ['personal'],
        version: '0.1.0',
        createdAt: '',
        updatedAt: '',
      },
      body: '# Global instructions\n',
    };

    const result = await service.save({ artifact: fresh, isCreate: true });

    expect(result.artifact.frontmatter.createdAt).not.toBe('');
    expect(result.artifact.frontmatter.updatedAt).not.toBe('');
    expect(result.artifact.frontmatter.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
