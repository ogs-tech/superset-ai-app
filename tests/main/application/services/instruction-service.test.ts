import { describe, it, expect, vi } from 'vitest';
import { InstructionService } from '../../../../src/main/application/services/instruction-service.js';
import { EntityService } from '../../../../src/main/application/services/entity-service.js';
import { InMemoryEntityRepository } from '../../../../src/main/infrastructure/entity/in-memory-entity-repository.js';
import { FixedClock } from '../../../../src/main/infrastructure/clock/fixed-clock.js';
import type { AdapterManager } from '../../../../src/main/application/services/adapter-manager.js';
import { WORKSPACE_SOURCE, type Instruction } from '../../../../src/shared/entity.js';

const instruction = (): Instruction => ({
  urn: 'urn:instruction:default', kind: 'instruction', name: 'default', description: '',
  scopes: ['personal'], metadata: { version: '0.0.0', createdAt: '', updatedAt: '' },
  source: WORKSPACE_SOURCE, content: '# Instructions\n', activation: 'always',
});

const setup = () => {
  const repo = new InMemoryEntityRepository();
  const adapterManager = { syncEntity: vi.fn().mockResolvedValue([]), removeEntity: vi.fn().mockResolvedValue([]) } as unknown as AdapterManager;
  const base = new EntityService(repo, new FixedClock(new Date('2026-04-26T10:00:00.000Z')), adapterManager);
  return { service: new InstructionService(base) };
};

describe('InstructionService', () => {
  it('saves and gets the default instruction', async () => {
    const { service } = setup();
    await service.save({ instruction: instruction(), isCreate: true });
    const got = await service.get();
    expect(got.urn).toBe('urn:instruction:default');
    expect(got.content).toContain('# Instructions');
  });
});
