import { describe, it, expect, beforeEach } from 'vitest';
import { FsSkillRepository } from '../../../../src/main/infrastructure/customization/fs-skill-repository.js';
import { FsAgentRepository } from '../../../../src/main/infrastructure/customization/fs-agent-repository.js';
import { FsReferenceRepository } from '../../../../src/main/infrastructure/customization/fs-reference-repository.js';
import { FsGlobalInstructionRepository } from '../../../../src/main/infrastructure/customization/fs-global-instruction-repository.js';
import type { CustomizationRepository } from '../../../../src/main/application/ports/customization-repository.js';
import type {
  Customization,
  CustomizationFrontmatter,
} from '../../../../src/shared/customization.js';
import type { SkillFrontmatter } from '../../../../src/main/application/schemas/skill.js';
import type { AgentFrontmatter } from '../../../../src/main/application/schemas/agent.js';
import type { ReferenceFrontmatter } from '../../../../src/main/application/schemas/reference.js';
import { skillId } from '../../../../src/main/domain/skill-id.js';
import { agentId } from '../../../../src/main/domain/agent-id.js';
import { referenceId } from '../../../../src/main/domain/reference-id.js';
import { globalInstructionId } from '../../../../src/main/domain/global-instruction-id.js';
import { DomainError } from '../../../../src/main/domain/errors.js';

const isoNow = () => new Date().toISOString();

class FakeCustomizationRepository implements CustomizationRepository {
  private store = new Map<string, Customization>();

  async list(query: { type?: 'skill' | 'reference' | 'agent' | 'global-instruction' } = {}) {
    const items = [...this.store.values()];
    return query.type ? items.filter((c) => c.frontmatter.type === query.type) : items;
  }

  async get(query: { id: string }) {
    const c = this.store.get(query.id);
    if (!c) throw new DomainError('not_found', `not found: ${query.id}`, { id: query.id });
    return c;
  }

  async save(command: { customization: Customization }) {
    this.store.set(command.customization.id, command.customization);
    return command.customization;
  }

  async delete(command: { id: string }) {
    if (!this.store.has(command.id)) {
      throw new DomainError('not_found', `not found: ${command.id}`, { id: command.id });
    }
    this.store.delete(command.id);
  }

  async exists(query: { id: string }) {
    return this.store.has(query.id);
  }
}

function fm<T extends CustomizationFrontmatter['type']>(
  type: T,
  name: string,
): CustomizationFrontmatter & { type: T } {
  return {
    name,
    type,
    description: `${type} ${name}`,
    scopes: type === 'global-instruction' ? ['personal'] : ['project'],
    version: '1.0.0',
    createdAt: isoNow(),
    updatedAt: isoNow(),
  } as CustomizationFrontmatter & { type: T };
}

describe('FsSkillRepository', () => {
  let base: FakeCustomizationRepository;
  let repo: FsSkillRepository;

  beforeEach(() => {
    base = new FakeCustomizationRepository();
    repo = new FsSkillRepository(base);
  });

  it('lists only skills with workspace source', async () => {
    await base.save({ customization: { id: 'skill/foo', frontmatter: fm('skill', 'foo'), body: 'x' } });
    await base.save({ customization: { id: 'agent/bar', frontmatter: fm('agent', 'bar'), body: 'y' } });
    const skills = await repo.list();
    expect(skills).toHaveLength(1);
    const [s] = skills;
    expect(s!.id).toBe('foo');
    expect(s!.source.kind).toBe('workspace');
    expect(s!.body).toBe('x');
  });

  it('save round-trips through base repository', async () => {
    const skill = {
      id: skillId('foo'),
      frontmatter: fm('skill', 'foo') as unknown as SkillFrontmatter,
      source: { kind: 'workspace' as const },
      body: 'content',
    };
    await repo.save({ skill });
    expect(await repo.exists({ id: skillId('foo') })).toBe(true);
    const got = await repo.get({ id: skillId('foo') });
    expect(got.id).toBe('foo');
    expect(got.body).toBe('content');
  });

  it('delete removes the skill', async () => {
    await base.save({ customization: { id: 'skill/foo', frontmatter: fm('skill', 'foo'), body: 'x' } });
    await repo.delete({ id: skillId('foo') });
    expect(await repo.exists({ id: skillId('foo') })).toBe(false);
  });
});

describe('FsAgentRepository', () => {
  it('lists only agents', async () => {
    const base = new FakeCustomizationRepository();
    const repo = new FsAgentRepository(base);
    await base.save({ customization: { id: 'agent/reviewer', frontmatter: fm('agent', 'reviewer'), body: 'a' } });
    await base.save({ customization: { id: 'skill/foo', frontmatter: fm('skill', 'foo'), body: 'b' } });
    const agents = await repo.list();
    expect(agents).toHaveLength(1);
    expect(agents[0]!.id).toBe('reviewer');
  });

  it('save and exists work', async () => {
    const repo = new FsAgentRepository(new FakeCustomizationRepository());
    await repo.save({
      agent: {
        id: agentId('reviewer'),
        frontmatter: fm('agent', 'reviewer') as unknown as AgentFrontmatter,
        source: { kind: 'workspace' },
        body: 'b',
      },
    });
    expect(await repo.exists({ id: agentId('reviewer') })).toBe(true);
  });
});

describe('FsReferenceRepository', () => {
  it('lists only references', async () => {
    const base = new FakeCustomizationRepository();
    const repo = new FsReferenceRepository(base);
    await base.save({
      customization: { id: 'reference/style', frontmatter: fm('reference', 'style'), body: 'r' },
    });
    const refs = await repo.list();
    expect(refs).toHaveLength(1);
    expect(refs[0]!.id).toBe('style');
  });

  it('save round-trip', async () => {
    const repo = new FsReferenceRepository(new FakeCustomizationRepository());
    await repo.save({
      reference: {
        id: referenceId('style'),
        frontmatter: fm('reference', 'style') as unknown as ReferenceFrontmatter,
        source: { kind: 'workspace' },
        body: 'r',
      },
    });
    const got = await repo.get({ id: referenceId('style') });
    expect(got.id).toBe('style');
  });
});

describe('FsGlobalInstructionRepository', () => {
  it('get/save/exists for default slug', async () => {
    const base = new FakeCustomizationRepository();
    const repo = new FsGlobalInstructionRepository(base);
    expect(await repo.exists({ id: globalInstructionId('default') })).toBe(false);

    await repo.save({
      globalInstruction: {
        id: globalInstructionId('default'),
        frontmatter: {
          name: 'default',
          type: 'global-instruction',
          description: 'global',
          scopes: ['personal'],
          version: '1.0.0',
          createdAt: isoNow(),
          updatedAt: isoNow(),
        },
        source: { kind: 'workspace' },
        body: 'rules',
      },
    });

    expect(await repo.exists({ id: globalInstructionId('default') })).toBe(true);
    const got = await repo.get({ id: globalInstructionId('default') });
    expect(got.body).toBe('rules');
  });
});
