import { describe, it, expect, vi } from 'vitest';
import {
  PluginProvenanceService,
  provenanceKey,
} from '../../../../src/main/application/services/plugin-provenance.js';
import { SkillService } from '../../../../src/main/application/services/skill-service.js';
import { AgentService } from '../../../../src/main/application/services/agent-service.js';
import { CustomizationService } from '../../../../src/main/application/services/customization-service.js';
import { InMemoryCustomizationRepository } from '../../../../src/main/infrastructure/customization/in-memory-customization-repository.js';
import { InMemoryFileSystem } from '../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';
import { FixedClock } from '../../../../src/main/infrastructure/clock/fixed-clock.js';
import { FakePluginCachePort } from '../../../../src/main/application/services/__fixtures__/fake-plugin-cache-port.js';
import { skillId } from '../../../../src/main/domain/skill-id.js';
import { agentId } from '../../../../src/main/domain/agent-id.js';
import { pluginId } from '../../../../src/main/domain/plugin-id.js';
import { OperationNotAllowedForOriginError } from '../../../../src/main/domain/plugin-errors.js';
import type { AdapterManager } from '../../../../src/main/application/services/adapter-manager.js';
import type { Customization, CustomizationFrontmatter } from '../../../../src/shared/customization.js';
import type { SkillFrontmatter } from '../../../../src/main/application/schemas/skill.js';

const FROZEN = new Date('2026-04-26T10:00:00.000Z');

const fakeAdapterManager = () =>
  ({
    syncOne: vi.fn().mockResolvedValue([]),
    syncAll: vi.fn().mockResolvedValue([]),
    removeOne: vi.fn().mockResolvedValue([]),
  }) as unknown as AdapterManager;

const fm = <T extends CustomizationFrontmatter['type']>(
  type: T,
  name: string,
): CustomizationFrontmatter & { type: T } =>
  ({
    name,
    type,
    description: `${type} ${name}`,
    scopes: ['project'],
    version: '0.1.0',
    createdAt: FROZEN.toISOString(),
    updatedAt: FROZEN.toISOString(),
  }) as CustomizationFrontmatter & { type: T };

const skillFile = (name: string) =>
  `---\nname: ${name}\ntype: skill\ndescription: from plugin\nscopes:\n  - personal\nversion: 1.0.0\ncreatedAt: ${FROZEN.toISOString()}\nupdatedAt: ${FROZEN.toISOString()}\n---\nplugin skill body\n`;

const agentFile = (name: string) =>
  `---\nname: ${name}\ntype: agent\ndescription: plugin agent\nscopes:\n  - personal\nversion: 1.0.0\ncreatedAt: ${FROZEN.toISOString()}\nupdatedAt: ${FROZEN.toISOString()}\n---\nplugin agent body\n`;

describe('PluginProvenanceService (real)', () => {
  it('returns empty map when no plugin meta exists', async () => {
    const cache = new FakePluginCachePort();
    const fs = new InMemoryFileSystem();
    const svc = new PluginProvenanceService({ cache, fs });
    expect(await svc.forScope('personal')).toEqual(new Map());
  });

  it('discovers skills and agents from installed plugins', async () => {
    const cache = new FakePluginCachePort();
    const fs = new InMemoryFileSystem();
    const pid = pluginId('superpowers');
    cache.seedMeta('personal', {
      version: 2,
      plugins: [
        {
          id: pid,
          origin: 'imported',
          installedAt: FROZEN.toISOString(),
          scope: 'personal',
          enabled: true,
        },
      ],
    });
    const dir = cache.pluginDir('personal', pid);
    await fs.writeFile(`${dir}/skills/foo/SKILL.md`, skillFile('foo'));
    await fs.writeFile(`${dir}/skills/bar/SKILL.md`, skillFile('bar'));
    await fs.writeFile(`${dir}/agents/reviewer.md`, agentFile('reviewer'));

    const svc = new PluginProvenanceService({ cache, fs });
    const map = await svc.forScope('personal');
    expect(map.get(provenanceKey({ type: 'skill', name: 'foo' }))).toBe(pid);
    expect(map.get(provenanceKey({ type: 'skill', name: 'bar' }))).toBe(pid);
    expect(map.get(provenanceKey({ type: 'agent', name: 'reviewer' }))).toBe(pid);
  });

  it('skips silently when plugin dir is missing', async () => {
    const cache = new FakePluginCachePort();
    const fs = new InMemoryFileSystem();
    cache.seedMeta('personal', {
      version: 2,
      plugins: [
        {
          id: 'ghost',
          origin: 'imported',
          installedAt: FROZEN.toISOString(),
          scope: 'personal',
          enabled: true,
        },
      ],
    });
    const svc = new PluginProvenanceService({ cache, fs });
    expect(await svc.forScope('personal')).toEqual(new Map());
  });
});

describe('SkillService — provenance merging', () => {
  const setup = () => {
    const repo = new InMemoryCustomizationRepository();
    const cache = new FakePluginCachePort();
    const fs = new InMemoryFileSystem();
    const clock = new FixedClock(FROZEN);
    const adapterManager = fakeAdapterManager();
    const base = new CustomizationService(repo, clock, adapterManager);
    const provenance = new PluginProvenanceService({ cache, fs });
    const skills = new SkillService(base, { provenance, cache, fs });
    return { repo, cache, fs, skills };
  };

  it('list merges workspace skills with plugin-provided skills', async () => {
    const { repo, cache, fs, skills } = setup();
    await repo.save({
      customization: { id: 'skill/local', frontmatter: fm('skill', 'local'), body: 'l' } as Customization,
    });
    const pid = pluginId('superpowers');
    cache.seedMeta('personal', {
      version: 2,
      plugins: [
        {
          id: pid,
          origin: 'imported',
          installedAt: FROZEN.toISOString(),
          scope: 'personal',
          enabled: true,
        },
      ],
    });
    await fs.writeFile(
      `${cache.pluginDir('personal', pid)}/skills/from-plugin/SKILL.md`,
      skillFile('from-plugin'),
    );

    const list = await skills.list('personal');
    expect(list).toHaveLength(2);
    const local = list.find((s) => s.id === 'local');
    const fromPlugin = list.find((s) => s.id === 'from-plugin');
    expect(local!.source.kind).toBe('workspace');
    expect(fromPlugin!.source.kind).toBe('plugin');
    if (fromPlugin!.source.kind === 'plugin') {
      expect(fromPlugin!.source.pluginId).toBe('superpowers');
    }
  });

  it('list prefers workspace when name collides with a plugin-provided skill', async () => {
    const { repo, cache, fs, skills } = setup();
    await repo.save({
      customization: { id: 'skill/foo', frontmatter: fm('skill', 'foo'), body: 'workspace' } as Customization,
    });
    const pid = pluginId('superpowers');
    cache.seedMeta('personal', {
      version: 2,
      plugins: [
        {
          id: pid,
          origin: 'imported',
          installedAt: FROZEN.toISOString(),
          scope: 'personal',
          enabled: true,
        },
      ],
    });
    await fs.writeFile(
      `${cache.pluginDir('personal', pid)}/skills/foo/SKILL.md`,
      skillFile('foo'),
    );

    const list = await skills.list('personal');
    expect(list).toHaveLength(1);
    expect(list[0]!.source.kind).toBe('workspace');
    expect(list[0]!.body).toBe('workspace');
  });

  it('save throws OperationNotAllowedForOriginError when input has plugin source', async () => {
    const { skills } = setup();
    await expect(
      skills.save({
        skill: {
          id: skillId('foo'),
          frontmatter: fm('skill', 'foo') as unknown as SkillFrontmatter,
          source: { kind: 'plugin', pluginId: pluginId('p') },
          body: 'x',
        },
      }),
    ).rejects.toThrow(OperationNotAllowedForOriginError);
  });

  it('save throws when skill name matches a plugin-provided skill', async () => {
    const { cache, fs, skills } = setup();
    const pid = pluginId('superpowers');
    cache.seedMeta('personal', {
      version: 2,
      plugins: [
        {
          id: pid,
          origin: 'imported',
          installedAt: FROZEN.toISOString(),
          scope: 'personal',
          enabled: true,
        },
      ],
    });
    await fs.writeFile(
      `${cache.pluginDir('personal', pid)}/skills/foo/SKILL.md`,
      skillFile('foo'),
    );
    await expect(
      skills.save({
        skill: {
          id: skillId('foo'),
          frontmatter: fm('skill', 'foo') as unknown as SkillFrontmatter,
          source: { kind: 'workspace' },
          body: 'x',
        },
        scope: 'personal',
      }),
    ).rejects.toThrow(OperationNotAllowedForOriginError);
  });

  it('delete throws when name matches a plugin-provided skill', async () => {
    const { cache, fs, skills } = setup();
    const pid = pluginId('superpowers');
    cache.seedMeta('personal', {
      version: 2,
      plugins: [
        {
          id: pid,
          origin: 'imported',
          installedAt: FROZEN.toISOString(),
          scope: 'personal',
          enabled: true,
        },
      ],
    });
    await fs.writeFile(
      `${cache.pluginDir('personal', pid)}/skills/foo/SKILL.md`,
      skillFile('foo'),
    );
    await expect(
      skills.delete({ id: skillId('foo'), removeSymlinks: false, scope: 'personal' }),
    ).rejects.toThrow(OperationNotAllowedForOriginError);
  });
});

describe('AgentService — provenance merging', () => {
  it('list includes plugin agents with plugin source', async () => {
    const repo = new InMemoryCustomizationRepository();
    const cache = new FakePluginCachePort();
    const fs = new InMemoryFileSystem();
    const clock = new FixedClock(FROZEN);
    const adapterManager = fakeAdapterManager();
    const base = new CustomizationService(repo, clock, adapterManager);
    const provenance = new PluginProvenanceService({ cache, fs });
    const agents = new AgentService(base, { provenance, cache, fs });

    const pid = pluginId('superpowers');
    cache.seedMeta('personal', {
      version: 2,
      plugins: [
        {
          id: pid,
          origin: 'imported',
          installedAt: FROZEN.toISOString(),
          scope: 'personal',
          enabled: true,
        },
      ],
    });
    await fs.writeFile(
      `${cache.pluginDir('personal', pid)}/agents/reviewer.md`,
      agentFile('reviewer'),
    );

    const list = await agents.list('personal');
    expect(list).toHaveLength(1);
    expect(list[0]!.id).toBe('reviewer');
    expect(list[0]!.source.kind).toBe('plugin');
  });

  it('save rejects plugin-source input', async () => {
    const repo = new InMemoryCustomizationRepository();
    const clock = new FixedClock(FROZEN);
    const adapterManager = fakeAdapterManager();
    const base = new CustomizationService(repo, clock, adapterManager);
    const cache = new FakePluginCachePort();
    const fs = new InMemoryFileSystem();
    const provenance = new PluginProvenanceService({ cache, fs });
    const agents = new AgentService(base, { provenance, cache, fs });

    await expect(
      agents.save({
        agent: {
          id: agentId('reviewer'),
          frontmatter: fm('agent', 'reviewer') as never,
          source: { kind: 'plugin', pluginId: pluginId('p') },
          body: 'a',
        },
      }),
    ).rejects.toThrow(OperationNotAllowedForOriginError);
  });
});

describe('provenanceKey', () => {
  it('formats key as type/name', () => {
    expect(provenanceKey({ type: 'skill', name: 'foo' })).toBe('skill/foo');
    expect(provenanceKey({ type: 'agent', name: 'reviewer' })).toBe('agent/reviewer');
  });
});
