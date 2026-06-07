import { describe, expect, it } from 'vitest';
import {
  collectPluginEntities,
  assertNotPluginSourced,
  type PluginEntityDeps,
} from '../../../../src/main/application/services/customization-plugin-helpers.js';
import type { PluginEntityRef } from '../../../../src/main/application/services/plugin-provenance.js';
import { pluginId } from '../../../../src/main/domain/plugin-id.js';
import { OperationNotAllowedForOriginError } from '../../../../src/main/domain/plugin-errors.js';

function makeDeps(
  provenanceMap: Map<string, ReturnType<typeof pluginId>>,
  files: Record<string, string>,
): PluginEntityDeps {
  // Derive PluginEntityRef[] from the map for scan(), keeping forScope() for assertNotPluginSourced.
  const refs: PluginEntityRef[] = [];
  for (const [key, pid] of provenanceMap.entries()) {
    const slashIdx = key.indexOf('/');
    const type = key.slice(0, slashIdx) as PluginEntityRef['type'];
    const name = key.slice(slashIdx + 1);
    refs.push({ type, name, pluginId: pid, dir: `/cache/${pid}`, provenance: 'workspace-managed' });
  }

  return {
    provenance: {
      forScope: async () => provenanceMap,
      scan: async () => refs,
    } as unknown as PluginEntityDeps['provenance'],
    fs: {
      readFile: async (path: string) => {
        const content = files[path];
        if (content === undefined) throw new Error(`ENOENT: ${path}`);
        return content;
      },
    } as unknown as PluginEntityDeps['fs'],
  };
}

describe('collectPluginEntities', () => {
  it('builds entities for keys matching the prefix and parses their files', async () => {
    const pid = pluginId('demo-plugin');
    const deps = makeDeps(
      new Map([
        ['skill/alpha', pid],
        ['agent/beta', pid], // ignored: wrong prefix
      ]),
      {
        '/cache/demo-plugin/skills/alpha/SKILL.md': '---\nname: alpha\n---\nAlpha body',
      },
    );

    const out = await collectPluginEntities(
      deps,
      {
        keyPrefix: 'skill/',
        relPath: (name) => `skills/${name}/SKILL.md`,
        build: ({ name, body, pluginId: p }) => ({ name, body, p }),
      },
      'personal',
    );

    expect(out).toEqual([{ name: 'alpha', body: 'Alpha body', p: pid }]);
  });

  it('passes frontmatter intact so per-service build merges work (command pattern)', async () => {
    const pid = pluginId('demo-plugin');
    const deps = makeDeps(new Map([['command/greet', pid]]), {
      '/cache/demo-plugin/commands/greet.md': '---\ndescription: hi\n---\nGreet body',
    });

    const out = await collectPluginEntities(
      deps,
      {
        keyPrefix: 'command/',
        relPath: (name) => `commands/${name}.md`,
        build: ({ name, frontmatter, body }) => ({
          ...(frontmatter as Record<string, unknown>),
          name,
          type: 'command',
          body,
        }),
      },
      'personal',
    );

    expect(out).toEqual([
      { description: 'hi', name: 'greet', type: 'command', body: 'Greet body' },
    ]);
  });

  it('skips entities whose file is unreadable', async () => {
    const pid = pluginId('demo-plugin');
    const deps = makeDeps(new Map([['skill/missing', pid]]), {});

    const out = await collectPluginEntities(
      deps,
      {
        keyPrefix: 'skill/',
        relPath: (name) => `skills/${name}/SKILL.md`,
        build: ({ name }) => ({ name }),
      },
      'personal',
    );

    expect(out).toEqual([]);
  });
});

describe('assertNotPluginSourced', () => {
  it('is a no-op when deps are absent', async () => {
    await expect(
      assertNotPluginSourced(undefined, {
        type: 'skill',
        operation: 'save',
        name: 'alpha',
        scope: 'personal',
      }),
    ).resolves.toBeUndefined();
  });

  it('throws OperationNotAllowedForOriginError when the entity is plugin-sourced', async () => {
    const pid = pluginId('demo-plugin');
    const deps = makeDeps(new Map([['skill/alpha', pid]]), {});

    await expect(
      assertNotPluginSourced(deps, {
        type: 'skill',
        operation: 'delete',
        name: 'alpha',
        scope: 'personal',
      }),
    ).rejects.toBeInstanceOf(OperationNotAllowedForOriginError);
  });
});
