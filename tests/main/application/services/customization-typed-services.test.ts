import { describe, it, expect, vi } from 'vitest';
import { CustomizationService } from '../../../../src/main/application/services/customization-service.js';
import { SkillService } from '../../../../src/main/application/services/skill-service.js';
import { AgentService } from '../../../../src/main/application/services/agent-service.js';
import { CommandService } from '../../../../src/main/application/services/command-service.js';
import { GlobalInstructionService } from '../../../../src/main/application/services/global-instruction-service.js';
import { InMemoryCustomizationRepository } from '../../../../src/main/infrastructure/customization/in-memory-customization-repository.js';
import { FixedClock } from '../../../../src/main/infrastructure/clock/fixed-clock.js';
import { skillId } from '../../../../src/main/domain/skill-id.js';
import { agentId } from '../../../../src/main/domain/agent-id.js';
import { commandId } from '../../../../src/main/domain/command-id.js';
import { globalInstructionId } from '../../../../src/main/domain/global-instruction-id.js';
import type { AdapterManager } from '../../../../src/main/application/services/adapter-manager.js';
import type { Customization, CustomizationFrontmatter } from '../../../../src/shared/customization.js';
import type { SkillFrontmatter } from '../../../../src/main/application/schemas/skill.js';
import type { AgentFrontmatter } from '../../../../src/main/application/schemas/agent.js';
import type { CommandFrontmatter } from '../../../../src/main/application/schemas/command.js';
import type { GlobalInstructionFrontmatter } from '../../../../src/main/application/schemas/global-instruction.js';

const FROZEN = new Date('2026-04-26T10:00:00.000Z');

const fakeAdapterManager = () =>
  ({
    syncOne: vi.fn().mockResolvedValue([]),
    syncAll: vi.fn().mockResolvedValue([]),
    removeOne: vi.fn().mockResolvedValue([]),
  }) as unknown as AdapterManager;

const setup = () => {
  const repo = new InMemoryCustomizationRepository();
  const clock = new FixedClock(FROZEN);
  const adapterManager = fakeAdapterManager();
  const base = new CustomizationService(repo, clock, adapterManager);
  return {
    repo,
    base,
    skills: new SkillService(base),
    agents: new AgentService(base),
    commands: new CommandService(base),
    globalInstructions: new GlobalInstructionService(base),
  };
};

const makeFm = <T extends CustomizationFrontmatter['type']>(
  type: T,
  name: string,
): CustomizationFrontmatter & { type: T } => ({
  name,
  type,
  description: `${type} ${name}`,
  scopes: type === 'global-instruction' ? ['personal'] : ['project'],
  version: '0.1.0',
  createdAt: '',
  updatedAt: '',
});

const seed = async (repo: InMemoryCustomizationRepository, c: Customization) => {
  await repo.save({ customization: c });
};

describe('SkillService (facade)', () => {
  it('list returns workspace-source skills with branded ids', async () => {
    const { skills, repo } = setup();
    await seed(repo, { id: 'skill/foo', frontmatter: makeFm('skill', 'foo'), body: 'x' });
    await seed(repo, { id: 'agent/bar', frontmatter: makeFm('agent', 'bar'), body: 'y' });

    const list = await skills.list();
    expect(list).toHaveLength(1);
    const [s] = list;
    expect(s!.id).toBe('foo');
    expect(s!.source.kind).toBe('workspace');
  });

  it('save creates and returns typed Skill', async () => {
    const { skills } = setup();
    const skill = {
      id: skillId('foo'),
      frontmatter: makeFm('skill', 'foo') as unknown as SkillFrontmatter,
      source: { kind: 'workspace' as const },
      body: 'content',
    };
    const result = await skills.save({ skill, isCreate: true });
    expect(result.skill.id).toBe('foo');
    expect(result.skill.body).toBe('content');
    expect(result.skill.source.kind).toBe('workspace');
  });

  it('get and delete by branded id', async () => {
    const { skills, repo } = setup();
    await seed(repo, { id: 'skill/foo', frontmatter: makeFm('skill', 'foo'), body: 'x' });
    const got = await skills.get(skillId('foo'));
    expect(got.id).toBe('foo');
    await skills.delete({ id: skillId('foo'), removeSymlinks: false });
    expect(repo.list({ type: 'skill' })).resolves.toHaveLength(0);
  });
});

describe('AgentService (facade)', () => {
  it('list filters to agents only', async () => {
    const { agents, repo } = setup();
    await seed(repo, { id: 'agent/reviewer', frontmatter: makeFm('agent', 'reviewer'), body: 'a' });
    await seed(repo, { id: 'skill/foo', frontmatter: makeFm('skill', 'foo'), body: 'b' });
    const list = await agents.list();
    expect(list).toHaveLength(1);
    expect(list[0]!.id).toBe('reviewer');
  });

  it('save and get round-trip', async () => {
    const { agents } = setup();
    await agents.save({
      agent: {
        id: agentId('reviewer'),
        frontmatter: makeFm('agent', 'reviewer') as unknown as AgentFrontmatter,
        source: { kind: 'workspace' },
        body: 'a',
      },
      isCreate: true,
    });
    const got = await agents.get(agentId('reviewer'));
    expect(got.id).toBe('reviewer');
  });
});

describe('CommandService (facade)', () => {
  it('list filters to commands only', async () => {
    const { commands, repo } = setup();
    await seed(repo, {
      id: 'command/feature-dev',
      frontmatter: makeFm('command', 'feature-dev'),
      body: 'c',
    });
    await seed(repo, { id: 'skill/foo', frontmatter: makeFm('skill', 'foo'), body: 's' });
    const list = await commands.list();
    expect(list).toHaveLength(1);
    expect(list[0]!.id).toBe('feature-dev');
  });

  it('save and get round-trip', async () => {
    const { commands } = setup();
    await commands.save({
      command: {
        id: commandId('feature-dev'),
        frontmatter: makeFm('command', 'feature-dev') as unknown as CommandFrontmatter,
        source: { kind: 'workspace' },
        body: 'workflow body',
      },
      isCreate: true,
    });
    const got = await commands.get(commandId('feature-dev'));
    expect(got.id).toBe('feature-dev');
    expect(got.body).toBe('workflow body');
  });
});

describe('GlobalInstructionService (facade)', () => {
  it('save and get for default slug', async () => {
    const { globalInstructions } = setup();
    await globalInstructions.save({
      globalInstruction: {
        id: globalInstructionId('default'),
        frontmatter: makeFm(
          'global-instruction',
          'default',
        ) as unknown as GlobalInstructionFrontmatter,
        source: { kind: 'workspace' },
        body: 'rules',
      },
      isCreate: true,
    });
    const got = await globalInstructions.get(globalInstructionId('default'));
    expect(got.id).toBe('default');
    expect(got.body).toBe('rules');
  });
});
