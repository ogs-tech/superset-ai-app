import { describe, expect, it, vi } from 'vitest';
import { CustomizationService } from '../../../../../src/main/application/services/customization-service.js';
import { InMemoryCustomizationRepository } from '../../../../../src/main/infrastructure/customization/in-memory-customization-repository.js';
import { FixedClock } from '../../../../../src/main/infrastructure/clock/fixed-clock.js';
import type { AdapterManager } from '../../../../../src/main/application/services/adapter-manager.js';
import type {
  Customization,
  CustomizationFrontmatter,
  CustomizationScope,
} from '../../../../../src/shared/customization.js';

const FROZEN = new Date('2026-04-26T10:00:00.000Z');

const globalInstructionFrontmatter = (
  overrides: Partial<CustomizationFrontmatter> = {},
): CustomizationFrontmatter => ({
  name: 'default',
  type: 'global-instruction',
  description: 'global instruction file',
  scopes: ['personal'],
  version: '0.1.0',
  createdAt: '',
  updatedAt: '',
  ...overrides,
});

const makeCustomization = (scopes: CustomizationScope[]): Customization => ({
  id: '',
  frontmatter: globalInstructionFrontmatter({ scopes }),
  body: '# global instruction\n',
});

const setup = () => {
  const repo = new InMemoryCustomizationRepository();
  const clock = new FixedClock(FROZEN);
  const adapterManager = {
    syncOne: vi.fn().mockResolvedValue([]),
    syncAll: vi.fn().mockResolvedValue([]),
    removeOne: vi.fn().mockResolvedValue([]),
  } as unknown as AdapterManager;
  const service = new CustomizationService(repo, clock, adapterManager);
  return { service };
};

describe('CustomizationService.save — global-instruction scope enforcement (AC#3)', () => {
  it('rejects scopes ["project"] with reason: global-instruction-scope-must-be-personal', async () => {
    const { service } = setup();
    const customization = makeCustomization(['project']);

    await expect(service.save({ customization, isCreate: true })).rejects.toMatchObject({
      kind: 'validation',
      details: { reason: 'global-instruction-scope-must-be-personal' },
    });
  });

  it('rejects scopes ["personal", "project"] with reason: global-instruction-scope-must-be-personal', async () => {
    const { service } = setup();
    const customization = makeCustomization(['personal', 'project']);

    await expect(service.save({ customization, isCreate: true })).rejects.toMatchObject({
      kind: 'validation',
      details: { reason: 'global-instruction-scope-must-be-personal' },
    });
  });

  it('rejects empty scopes [] with reason: global-instruction-scope-must-be-personal', async () => {
    const { service } = setup();
    const customization = makeCustomization([]);

    await expect(service.save({ customization, isCreate: true })).rejects.toMatchObject({
      kind: 'validation',
      details: { reason: 'global-instruction-scope-must-be-personal' },
    });
  });

  it('accepts scopes ["personal"]', async () => {
    const { service } = setup();
    const customization = makeCustomization(['personal']);

    const result = await service.save({ customization, isCreate: true });
    expect(result.customization.frontmatter.scopes).toEqual(['personal']);
  });
});
