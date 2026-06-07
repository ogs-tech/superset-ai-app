import { describe, it, expect, vi } from 'vitest';
import { ClaudeCodePluginReader } from '../../../../src/main/infrastructure/plugins/claude-code-plugin-reader.js';
import { InMemoryFileSystem } from '../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';

const REGISTRY = '/home/.claude/plugins/installed_plugins.json';

const reader = (fs: InMemoryFileSystem) =>
  new ClaudeCodePluginReader({ registryPath: REGISTRY, fs });

const validRegistry = JSON.stringify({
  version: 2,
  plugins: {
    'feature-dev@claude-plugins-official': [
      {
        scope: 'user',
        installPath: '/home/.claude/plugins/cache/claude-plugins-official/feature-dev/unknown',
        version: 'unknown',
        installedAt: '2026-06-06T20:39:35.422Z',
        lastUpdated: '2026-06-06T20:39:35.422Z',
      },
    ],
    'code-review@claude-plugins-official': [
      {
        scope: 'user',
        installPath: '/home/.claude/plugins/cache/claude-plugins-official/code-review/unknown',
        version: 'unknown',
        installedAt: '2026-06-06T20:39:35.422Z',
        lastUpdated: '2026-06-06T20:39:35.422Z',
      },
    ],
  },
});

describe('ClaudeCodePluginReader', () => {
  it('returns an empty list when the registry file is missing', async () => {
    const fs = new InMemoryFileSystem();
    expect(await reader(fs).list()).toEqual([]);
  });

  it('treats corrupt JSON as empty without throwing', async () => {
    const fs = new InMemoryFileSystem();
    fs.createFile(REGISTRY, '{ not valid json');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await reader(fs).list()).toEqual([]);
    warn.mockRestore();
  });

  it('parses each install into a descriptor, using installPath verbatim', async () => {
    const fs = new InMemoryFileSystem();
    fs.createFile(REGISTRY, validRegistry);
    const descriptors = await reader(fs).list();
    expect(descriptors).toContainEqual({
      pluginId: 'feature-dev',
      marketplace: 'claude-plugins-official',
      installPath: '/home/.claude/plugins/cache/claude-plugins-official/feature-dev/unknown',
      version: 'unknown',
      scope: 'user',
    });
    expect(descriptors).toHaveLength(2);
  });

  it('skips installs whose plugin name is not a valid PluginId', async () => {
    const fs = new InMemoryFileSystem();
    fs.createFile(
      REGISTRY,
      JSON.stringify({
        version: 2,
        plugins: {
          'Bad_Name@mp': [{ scope: 'user', installPath: '/x', version: '1' }],
        },
      }),
    );
    expect(await reader(fs).list()).toEqual([]);
  });

  it('skips installs with a non-user scope', async () => {
    const fs = new InMemoryFileSystem();
    fs.createFile(
      REGISTRY,
      JSON.stringify({
        version: 2,
        plugins: {
          'feature-dev@mp': [{ scope: 'project', installPath: '/x', version: '1' }],
        },
      }),
    );
    expect(await reader(fs).list()).toEqual([]);
  });

  it('skips keys with an empty marketplace (trailing @)', async () => {
    const fs = new InMemoryFileSystem();
    fs.createFile(
      REGISTRY,
      JSON.stringify({
        version: 2,
        plugins: {
          'feature-dev@': [{ scope: 'user', installPath: '/x', version: '1' }],
        },
      }),
    );
    expect(await reader(fs).list()).toEqual([]);
  });
});
