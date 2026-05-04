import { describe, it, expect, vi } from 'vitest';
import { CustomizationService } from '../../../../../src/main/application/services/customization-service.js';
import { SchemaValidator } from '../../../../../src/main/application/services/schema-validator.js';
import { InMemoryCustomizationRepository } from '../../../../../src/main/infrastructure/customization/in-memory-customization-repository.js';
import { FixedClock } from '../../../../../src/main/infrastructure/clock/fixed-clock.js';
import type { AdapterManager } from '../../../../../src/main/application/services/adapter-manager.js';
import type { Customization } from '../../../../../src/shared/customization.js';

const invalidCustomization: Customization = {
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
  const repo = new InMemoryCustomizationRepository();
  const clock = new FixedClock(new Date('2026-05-03T00:00:00.000Z'));
  const adapterManager = {
    syncOne: vi.fn().mockResolvedValue([]),
    syncAll: vi.fn().mockResolvedValue([]),
    removeOne: vi.fn().mockResolvedValue([]),
  } as unknown as AdapterManager;
  const schemaValidator = new SchemaValidator();
  const service = new CustomizationService(repo, clock, adapterManager, schemaValidator);
  return { repo, service, adapterManager };
};

describe('CustomizationService.save — SchemaValidator integration (AC#14)', () => {
  it('save(invalidCustomization) throws DomainError({ kind: "validation", details: { errors } })', async () => {
    const { service } = setup();

    await expect(service.save({ customization: invalidCustomization })).rejects.toMatchObject({
      kind: 'validation',
      details: { errors: expect.arrayContaining([expect.objectContaining({ path: expect.any(String), kind: expect.any(String), message: expect.any(String) })]) },
    });
  });

  it('repo.save is NOT called when validation fails', async () => {
    const { service, repo } = setup();
    const saveSpy = vi.spyOn(repo, 'save');

    await expect(service.save({ customization: invalidCustomization })).rejects.toBeDefined();

    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('accepts empty createdAt/updatedAt on create (service stamps them) when SchemaValidator is wired', async () => {
    const { service } = setup();
    const fresh: Customization = {
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

    const result = await service.save({ customization: fresh, isCreate: true });

    expect(result.customization.frontmatter.createdAt).not.toBe('');
    expect(result.customization.frontmatter.updatedAt).not.toBe('');
    expect(result.customization.frontmatter.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
