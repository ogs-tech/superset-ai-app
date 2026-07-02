import { describe, it, expect, vi } from 'vitest';
import { buildSkillHandlers } from '../../../src/main/ipc/skill-handlers.js';
import { buildAgentHandlers } from '../../../src/main/ipc/agent-handlers.js';
import { buildCommandHandlers } from '../../../src/main/ipc/command-handlers.js';
import { buildGlobalInstructionHandlers } from '../../../src/main/ipc/global-instruction-handlers.js';
import { buildMarketplaceHandlers } from '../../../src/main/ipc/marketplace-handlers.js';
import { SkillService } from '../../../src/main/application/services/skill-service.js';
import { AgentService } from '../../../src/main/application/services/agent-service.js';
import { EntityService } from '../../../src/main/application/services/entity-service.js';
import { InMemoryEntityRepository } from '../../../src/main/infrastructure/entity/in-memory-entity-repository.js';
import { FixedClock } from '../../../src/main/infrastructure/clock/fixed-clock.js';
import type { AdapterManager } from '../../../src/main/application/services/adapter-manager.js';
import type { CommandService } from '../../../src/main/application/services/command-service.js';
import type { GlobalInstructionService } from '../../../src/main/application/services/global-instruction-service.js';
import type { MarketplaceService } from '../../../src/main/application/services/marketplace-service.js';
import { WORKSPACE_SOURCE, type Skill, type Agent } from '../../../src/shared/entity.js';

const skill = (name = 'foo'): Skill => ({
  urn: `urn:skill:${name}`,
  kind: 'skill',
  name,
  description: 'd',
  scopes: ['personal'],
  metadata: { version: '0.1.0', createdAt: '', updatedAt: '' },
  source: WORKSPACE_SOURCE,
  content: 'b',
});

const setupSkillService = () => {
  const repo = new InMemoryEntityRepository();
  const adapterManager = {
    syncEntity: vi.fn().mockResolvedValue([]),
    removeEntity: vi.fn().mockResolvedValue([]),
  } as unknown as AdapterManager;
  const base = new EntityService(repo, new FixedClock(new Date('2026-04-26T10:00:00.000Z')), adapterManager);
  return new SkillService(base);
};

const agent = (name = 'reviewer'): Agent => ({
  urn: `urn:agent:${name}`,
  kind: 'agent',
  name,
  description: 'd',
  scopes: ['personal'],
  metadata: { version: '0.1.0', createdAt: '', updatedAt: '' },
  source: WORKSPACE_SOURCE,
  systemPrompt: 'You review.',
});

const setupAgentService = () => {
  const repo = new InMemoryEntityRepository();
  const adapterManager = {
    syncEntity: vi.fn().mockResolvedValue([]),
    removeEntity: vi.fn().mockResolvedValue([]),
  } as unknown as AdapterManager;
  const base = new EntityService(repo, new FixedClock(new Date('2026-04-26T10:00:00.000Z')), adapterManager);
  return new AgentService(base);
};

describe('skill-handlers', () => {
  it('skill.list calls service.list', async () => {
    const svc = setupSkillService();
    const spy = vi.spyOn(svc, 'list');
    const h = buildSkillHandlers(svc);
    await h['skill.list']!({});
    expect(spy).toHaveBeenCalled();
  });

  it('skill.get brands the id', async () => {
    const svc = setupSkillService();
    await svc.save({ skill: skill('foo'), isCreate: true });
    const spy = vi.spyOn(svc, 'get');
    const h = buildSkillHandlers(svc);
    await h['skill.get']!({ id: 'foo' });
    expect(spy).toHaveBeenCalledWith('foo');
  });

  it('skill.delete passes branded id and removeSymlinks', async () => {
    const svc = setupSkillService();
    await svc.save({ skill: skill('foo'), isCreate: true });
    const spy = vi.spyOn(svc, 'delete');
    const h = buildSkillHandlers(svc);
    await h['skill.delete']!({ id: 'foo', removeSymlinks: true });
    expect(spy).toHaveBeenCalledWith({ id: 'foo', removeSymlinks: true });
  });

  it('skill.save passes through skill payload', async () => {
    const svc = setupSkillService();
    const spy = vi.spyOn(svc, 'save');
    const h = buildSkillHandlers(svc);
    await h['skill.save']!({ skill: skill('foo'), isCreate: true });
    expect(spy).toHaveBeenCalled();
  });

  it('skill.get rejects empty id', async () => {
    const h = buildSkillHandlers(setupSkillService());
    await expect(h['skill.get']!({ id: '' })).rejects.toMatchObject({ kind: 'validation' });
  });
});

describe('agent-handlers', () => {
  it('agent.list calls service.list', async () => {
    const svc = setupAgentService();
    const spy = vi.spyOn(svc, 'list');
    const h = buildAgentHandlers(svc);
    await h['agent.list']!({});
    expect(spy).toHaveBeenCalled();
  });

  it('agent.get brands the id', async () => {
    const svc = setupAgentService();
    await svc.save({ agent: agent('reviewer'), isCreate: true });
    const spy = vi.spyOn(svc, 'get');
    const h = buildAgentHandlers(svc);
    await h['agent.get']!({ id: 'reviewer' });
    expect(spy).toHaveBeenCalledWith('reviewer');
  });

  it('agent.delete brands the id', async () => {
    const svc = setupAgentService();
    await svc.save({ agent: agent('reviewer'), isCreate: true });
    const spy = vi.spyOn(svc, 'delete');
    const h = buildAgentHandlers(svc);
    await h['agent.delete']!({ id: 'reviewer', removeSymlinks: false });
    expect(spy).toHaveBeenCalledWith({ id: 'reviewer', removeSymlinks: false });
  });

  it('agent.save passes through agent payload', async () => {
    const svc = setupAgentService();
    const spy = vi.spyOn(svc, 'save');
    const h = buildAgentHandlers(svc);
    await h['agent.save']!({ agent: agent('reviewer'), isCreate: true });
    expect(spy).toHaveBeenCalled();
  });
});

describe('command-handlers', () => {
  const fakeCommandService = () =>
    ({
      list: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue({ id: 'feature-dev', body: 'b', frontmatter: {}, source: { kind: 'workspace' } }),
      save: vi.fn().mockResolvedValue({ command: { id: 'feature-dev' }, syncReport: [] }),
      delete: vi.fn().mockResolvedValue({ ok: true }),
    }) as unknown as CommandService;

  it('command.list calls service.list with default personal scope', async () => {
    const svc = fakeCommandService();
    const h = buildCommandHandlers(svc);
    await h['command.list']!({});
    expect(svc.list).toHaveBeenCalledWith('personal');
  });

  it('command.list passes explicit scope', async () => {
    const svc = fakeCommandService();
    const h = buildCommandHandlers(svc);
    await h['command.list']!({ scope: 'project' });
    expect(svc.list).toHaveBeenCalledWith('project');
  });

  it('command.get brands the id', async () => {
    const svc = fakeCommandService();
    const h = buildCommandHandlers(svc);
    await h['command.get']!({ id: 'feature-dev' });
    expect(svc.get).toHaveBeenCalledWith('feature-dev');
  });

  it('command.get rejects empty id', async () => {
    const h = buildCommandHandlers(fakeCommandService());
    await expect(h['command.get']!({ id: '' })).rejects.toMatchObject({ kind: 'validation' });
  });

  it('command.save passes through command payload', async () => {
    const svc = fakeCommandService();
    const h = buildCommandHandlers(svc);
    await h['command.save']!({ command: { id: 'feature-dev' }, isCreate: true });
    expect(svc.save).toHaveBeenCalled();
  });

  it('command.delete passes branded id and removeSymlinks', async () => {
    const svc = fakeCommandService();
    const h = buildCommandHandlers(svc);
    await h['command.delete']!({ id: 'feature-dev', removeSymlinks: true });
    expect(svc.delete).toHaveBeenCalledWith({ id: 'feature-dev', removeSymlinks: true });
  });

  it('command.delete rejects missing removeSymlinks', async () => {
    const h = buildCommandHandlers(fakeCommandService());
    await expect(h['command.delete']!({ id: 'feature-dev' })).rejects.toMatchObject({ kind: 'validation' });
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
