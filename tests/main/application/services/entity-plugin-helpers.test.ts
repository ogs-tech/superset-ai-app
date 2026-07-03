import { describe, it, expect } from 'vitest';
import { InMemoryFileSystem } from '../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';
import {
  collectPluginEntities,
  assertEntityNotPluginSourced,
  type EntityPluginDeps,
} from '../../../../src/main/application/services/entity-plugin-helpers.js';
import type { PluginProvenanceService } from '../../../../src/main/application/services/plugin-provenance.js';
import type { Skill } from '../../../../src/shared/entity.js';

const SKILL_MD = ['---', 'name: demo', 'type: skill', 'description: from plugin',
  'scopes:', '  - personal', 'version: 1.0.0', '---', '# Demo', ''].join('\n');

const makeDeps = (): EntityPluginDeps => {
  const fs = new InMemoryFileSystem();
  fs.createFile('/plugins/p1/skills/demo/SKILL.md', SKILL_MD);
  const provenance = {
    scan: async () => [{ type: 'skill', name: 'demo', dir: '/plugins/p1', pluginId: 'p1', provenance: 'workspace-managed' }],
    forScope: async () => new Map([['skill/demo', 'p1']]),
  } as unknown as PluginProvenanceService;
  return { provenance, fs };
};

describe('collectPluginEntities', () => {
  it('parses a plugin SKILL.md into a canonical skill with plugin source', async () => {
    const deps = makeDeps();
    const skills = (await collectPluginEntities(deps, { kind: 'skill', relPath: (n) => `skills/${n}/SKILL.md` }, 'personal')) as Skill[];
    expect(skills).toHaveLength(1);
    expect(skills[0]?.urn).toBe('urn:skill:demo');
    expect(skills[0]?.source).toEqual({ kind: 'plugin', pluginId: 'p1', provenance: 'workspace-managed' });
  });
});

describe('assertEntityNotPluginSourced', () => {
  it('throws when the name is owned by a plugin', async () => {
    const deps = makeDeps();
    await expect(
      assertEntityNotPluginSourced(deps, { kind: 'skill', operation: 'save', name: 'demo', scope: 'personal' }),
    ).rejects.toMatchObject({ kind: 'validation' });
  });

  it('is a no-op when deps are absent', async () => {
    await expect(
      assertEntityNotPluginSourced(undefined, { kind: 'skill', operation: 'save', name: 'x', scope: 'personal' }),
    ).resolves.toBeUndefined();
  });
});
