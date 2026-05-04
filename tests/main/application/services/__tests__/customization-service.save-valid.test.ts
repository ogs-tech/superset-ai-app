import { describe, it, expect, vi } from 'vitest';
import { CustomizationService } from '../../../../../src/main/application/services/customization-service.js';
import { SchemaValidator } from '../../../../../src/main/application/services/schema-validator.js';
import { InMemoryCustomizationRepository } from '../../../../../src/main/infrastructure/customization/in-memory-customization-repository.js';
import { FixedClock } from '../../../../../src/main/infrastructure/clock/fixed-clock.js';
import type { AdapterManager } from '../../../../../src/main/application/services/adapter-manager.js';
import type { Customization } from '../../../../../src/shared/customization.js';

const validCustomization: Customization = {
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
  const repo = new InMemoryCustomizationRepository();
  const clock = new FixedClock(new Date('2026-05-03T00:00:00.000Z'));
  const adapterManager = {
    syncOne: vi.fn().mockResolvedValue([]),
    syncAll: vi.fn().mockResolvedValue([]),
    removeOne: vi.fn().mockResolvedValue([]),
  } as unknown as AdapterManager;
  const schemaValidator = new SchemaValidator();
  const service = new CustomizationService(repo, clock, adapterManager, schemaValidator);
  return { repo, service };
};

describe('CustomizationService.save — SchemaValidator regression (AC#15)', () => {
  it('save(validCustomization) reaches repo.save and returns { customization, syncReport }', async () => {
    const { service, repo } = setup();
    const saveSpy = vi.spyOn(repo, 'save');

    const result = await service.save({ customization: validCustomization, isCreate: true });

    expect(saveSpy).toHaveBeenCalledOnce();
    expect(result.customization).toBeDefined();
    expect(Array.isArray(result.syncReport)).toBe(true);
  });
});
