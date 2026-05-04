import { describe, expect, it, vi } from 'vitest';
import { CustomizationService } from '../../../../../src/main/application/services/customization-service.js';
import { InMemoryCustomizationRepository } from '../../../../../src/main/infrastructure/customization/in-memory-customization-repository.js';
import { FixedClock } from '../../../../../src/main/infrastructure/clock/fixed-clock.js';
import type { AdapterManager } from '../../../../../src/main/application/services/adapter-manager.js';
import type {
  Customization,
  CustomizationFrontmatter,
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

const makeCustomization = (overrides: Partial<CustomizationFrontmatter> = {}): Customization => ({
  id: '',
  frontmatter: globalInstructionFrontmatter(overrides),
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

describe('CustomizationService.save — global-instruction slug enum', () => {
  it('rejects slug "claude" with reason: global-instruction-slug-not-allowed', async () => {
    const { service } = setup();
    const customization = makeCustomization({ name: 'claude' });

    await expect(service.save({ customization, isCreate: true })).rejects.toMatchObject({
      kind: 'validation',
      details: { reason: 'global-instruction-slug-not-allowed' },
    });
  });

  it('rejects slug "copilot" with reason: global-instruction-slug-not-allowed', async () => {
    const { service } = setup();
    const customization = makeCustomization({ name: 'copilot' });

    await expect(service.save({ customization, isCreate: true })).rejects.toMatchObject({
      kind: 'validation',
      details: { reason: 'global-instruction-slug-not-allowed' },
    });
  });

  it('rejects slug "foo" with reason: global-instruction-slug-not-allowed', async () => {
    const { service } = setup();
    const customization = makeCustomization({ name: 'foo' });

    await expect(service.save({ customization, isCreate: true })).rejects.toMatchObject({
      kind: 'validation',
      details: { reason: 'global-instruction-slug-not-allowed' },
    });
  });

  it('rejects slug "Default" (case-sensitive) with reason: global-instruction-slug-not-allowed', async () => {
    const { service } = setup();
    const customization = makeCustomization({ name: 'Default' });

    await expect(service.save({ customization, isCreate: true })).rejects.toMatchObject({
      kind: 'validation',
      details: { reason: 'global-instruction-slug-not-allowed' },
    });
  });

  it('rejects empty slug "" with reason: global-instruction-slug-not-allowed', async () => {
    const { service } = setup();
    const customization = makeCustomization({ name: '' });

    await expect(service.save({ customization, isCreate: true })).rejects.toMatchObject({
      kind: 'validation',
      details: { reason: 'global-instruction-slug-not-allowed' },
    });
  });

  it('accepts slug "default"', async () => {
    const { service } = setup();
    const customization = makeCustomization({ name: 'default' });

    const result = await service.save({ customization, isCreate: true });
    expect(result.customization.frontmatter.name).toBe('default');
  });
});
