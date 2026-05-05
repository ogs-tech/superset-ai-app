import { describe, it, expect, vi } from 'vitest';
import { buildSkillHandlers } from '../../../src/main/ipc/skill-handlers.js';
import { buildAgentHandlers } from '../../../src/main/ipc/agent-handlers.js';
import { buildReferenceHandlers } from '../../../src/main/ipc/reference-handlers.js';
import { buildGlobalInstructionHandlers } from '../../../src/main/ipc/global-instruction-handlers.js';
import { buildMarketplaceHandlers } from '../../../src/main/ipc/marketplace-handlers.js';
import type { SkillService } from '../../../src/main/application/services/skill-service.js';
import type { AgentService } from '../../../src/main/application/services/agent-service.js';
import type { ReferenceService } from '../../../src/main/application/services/reference-service.js';
import type { GlobalInstructionService } from '../../../src/main/application/services/global-instruction-service.js';
import type { MarketplaceService } from '../../../src/main/application/services/marketplace-service.js';

const fakeSkillService = () =>
  ({
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue({ id: 'foo', body: 'b', frontmatter: {}, source: { kind: 'workspace' } }),
    save: vi.fn().mockResolvedValue({ skill: { id: 'foo' }, syncReport: [] }),
    delete: vi.fn().mockResolvedValue({ ok: true }),
  }) as unknown as SkillService;

describe('skill-handlers', () => {
  it('skill.list calls service.list', async () => {
    const svc = fakeSkillService();
    const h = buildSkillHandlers(svc);
    await h['skill.list']!({});
    expect(svc.list).toHaveBeenCalled();
  });

  it('skill.get brands the id', async () => {
    const svc = fakeSkillService();
    const h = buildSkillHandlers(svc);
    await h['skill.get']!({ id: 'foo' });
    expect(svc.get).toHaveBeenCalledWith('foo');
  });

  it('skill.delete passes branded id and removeSymlinks', async () => {
    const svc = fakeSkillService();
    const h = buildSkillHandlers(svc);
    await h['skill.delete']!({ id: 'foo', removeSymlinks: true });
    expect(svc.delete).toHaveBeenCalledWith({ id: 'foo', removeSymlinks: true });
  });

  it('skill.save passes through skill payload', async () => {
    const svc = fakeSkillService();
    const h = buildSkillHandlers(svc);
    await h['skill.save']!({ skill: { id: 'foo' }, isCreate: true });
    expect(svc.save).toHaveBeenCalled();
  });

  it('skill.get rejects empty id', async () => {
    const h = buildSkillHandlers(fakeSkillService());
    await expect(h['skill.get']!({ id: '' })).rejects.toMatchObject({ kind: 'validation' });
  });
});

describe('agent-handlers', () => {
  it('agent.list calls service.list', async () => {
    const svc = {
      list: vi.fn().mockResolvedValue([]),
    } as unknown as AgentService;
    const h = buildAgentHandlers(svc);
    await h['agent.list']!({});
    expect(svc.list).toHaveBeenCalled();
  });

  it('agent.delete brands the id', async () => {
    const svc = {
      delete: vi.fn().mockResolvedValue({ ok: true }),
    } as unknown as AgentService;
    const h = buildAgentHandlers(svc);
    await h['agent.delete']!({ id: 'reviewer', removeSymlinks: false });
    expect(svc.delete).toHaveBeenCalledWith({ id: 'reviewer', removeSymlinks: false });
  });
});

describe('reference-handlers', () => {
  it('reference.list calls service.list', async () => {
    const svc = {
      list: vi.fn().mockResolvedValue([]),
    } as unknown as ReferenceService;
    const h = buildReferenceHandlers(svc);
    await h['reference.list']!({});
    expect(svc.list).toHaveBeenCalled();
  });
});

describe('global-instruction-handlers', () => {
  it('global-instruction.get rejects non-default slug', async () => {
    const svc = {
      get: vi.fn(),
    } as unknown as GlobalInstructionService;
    const h = buildGlobalInstructionHandlers(svc);
    await expect(h['global-instruction.get']!({ id: 'other' })).rejects.toThrow(
      /must be one of/,
    );
  });

  it('global-instruction.get accepts default', async () => {
    const svc = {
      get: vi.fn().mockResolvedValue({ id: 'default' }),
    } as unknown as GlobalInstructionService;
    const h = buildGlobalInstructionHandlers(svc);
    await h['global-instruction.get']!({ id: 'default' });
    expect(svc.get).toHaveBeenCalledWith('default');
  });
});

describe('marketplace-handlers', () => {
  it('marketplace.list calls service with scope', async () => {
    const svc = {
      list: vi.fn().mockResolvedValue([]),
    } as unknown as MarketplaceService;
    const h = buildMarketplaceHandlers(svc);
    await h['marketplace.list']!({ scope: 'personal' });
    expect(svc.list).toHaveBeenCalledWith('personal');
  });

  it('marketplace.add validates source path', async () => {
    const svc = {
      add: vi.fn().mockResolvedValue(undefined),
    } as unknown as MarketplaceService;
    const h = buildMarketplaceHandlers(svc);
    await h['marketplace.add']!({
      scope: 'personal',
      id: 'foo',
      source: { path: '/x' },
    });
    expect(svc.add).toHaveBeenCalledWith('personal', {
      id: 'foo',
      source: { kind: 'directory', path: '/x' },
    });
  });

  it('marketplace.remove validates scope', async () => {
    const svc = {
      remove: vi.fn().mockResolvedValue(undefined),
    } as unknown as MarketplaceService;
    const h = buildMarketplaceHandlers(svc);
    await expect(
      h['marketplace.remove']!({ scope: 'invalid', id: 'foo' }),
    ).rejects.toMatchObject({ kind: 'validation' });
  });

  it('marketplace.refresh calls service.refresh', async () => {
    const svc = {
      refresh: vi.fn().mockResolvedValue(null),
    } as unknown as MarketplaceService;
    const h = buildMarketplaceHandlers(svc);
    await h['marketplace.refresh']!({ scope: 'personal', id: 'foo' });
    expect(svc.refresh).toHaveBeenCalledWith('personal', 'foo');
  });
});
