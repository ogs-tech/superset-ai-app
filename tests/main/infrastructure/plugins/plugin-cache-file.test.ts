import { mkdtemp, rm, writeFile, readFile, access, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PluginCacheFile } from '../../../../src/main/infrastructure/plugins/plugin-cache-file.js';
import { pluginId } from '../../../../src/main/domain/plugin-id.js';
import { semVer } from '../../../../src/main/domain/semver.js';
import type { PluginManifest } from '../../../../src/main/domain/plugin-manifest.js';
import type { Scope } from '../../../../src/main/application/ports/scope.js';

const scope: Scope = 'personal';

function makeManifest(id = 'my-plugin', version = '1.0.0'): PluginManifest {
  return {
    id: pluginId(id),
    version: semVer(version),
    description: 'A test plugin',
    artifacts: {
      skills: ['skill-a'],
      agents: [],
      commands: [],
      hooks: 0,
      mcp: false,
      lsp: false,
    },
  };
}

describe('PluginCacheFile', () => {
  let tmpDir: string;
  let cache: PluginCacheFile;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'plugin-cache-file-test-'));
    cache = new PluginCacheFile({
      pluginsDir: (s) => path.join(tmpDir, s, 'plugins'),
      cacheDir: (s) => path.join(tmpDir, s, 'cache'),
    });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  // 1. readMeta: absent file returns default v2 empty meta
  it('readMeta returns default v2 empty meta when file is absent', async () => {
    const meta = await cache.readMeta(scope);
    expect(meta).toEqual({ version: 2, plugins: [] });
  });

  // 2. readMeta: v1 JSON migrated to v2 with origin='imported'
  it('readMeta migrates v1 JSON to v2 with origin=imported', async () => {
    const pluginsDir = path.join(tmpDir, scope, 'plugins');
    await mkdir(pluginsDir, { recursive: true });
    const v1Data = {
      plugins: [
        {
          id: 'my-plugin',
          installedAt: '2024-01-01T00:00:00Z',
          scope: 'personal',
          enabled: true,
        },
      ],
    };
    await writeFile(path.join(pluginsDir, '_meta.json'), JSON.stringify(v1Data), 'utf8');

    const meta = await cache.readMeta(scope);

    expect(meta.version).toBe(2);
    expect(meta.plugins).toHaveLength(1);
    expect(meta.plugins[0]).toMatchObject({ id: 'my-plugin', origin: 'imported' });
  });

  // 3. readMeta: v2 file is returned as-is
  it('readMeta returns v2 data unchanged', async () => {
    const pluginsDir = path.join(tmpDir, scope, 'plugins');
    await mkdir(pluginsDir, { recursive: true });
    const v2Data = {
      version: 2,
      plugins: [
        {
          id: 'my-plugin',
          origin: 'imported',
          installedAt: '2024-01-01T00:00:00Z',
          scope: 'personal',
          enabled: true,
        },
      ],
    };
    await writeFile(path.join(pluginsDir, '_meta.json'), JSON.stringify(v2Data), 'utf8');

    const meta = await cache.readMeta(scope);

    expect(meta.version).toBe(2);
    expect(meta.plugins).toHaveLength(1);
    expect(meta.plugins[0]).toMatchObject({ id: 'my-plugin', origin: 'imported' });
  });

  // 4. writeMeta round-trip: writeMeta then readMeta returns same data
  it('writeMeta then readMeta returns same data', async () => {
    const metaToWrite = {
      version: 2 as const,
      plugins: [
        {
          id: 'round-trip-plugin',
          origin: 'owned' as const,
          installedAt: '2024-06-01T00:00:00Z',
          scope: 'personal' as const,
          enabled: true,
        },
      ],
    };

    await cache.writeMeta(scope, metaToWrite);
    const meta = await cache.readMeta(scope);

    expect(meta.version).toBe(2);
    expect(meta.plugins).toHaveLength(1);
    expect(meta.plugins[0]).toMatchObject({ id: 'round-trip-plugin', origin: 'owned' });
  });

  // 5. writeMeta atomic: no .tmp file after write
  it('writeMeta cleans up tmp file after atomic write', async () => {
    const metaToWrite = { version: 2 as const, plugins: [] };
    await cache.writeMeta(scope, metaToWrite);

    const pluginsDir = path.join(tmpDir, scope, 'plugins');
    const tmpFile = path.join(pluginsDir, '_meta.json.tmp');

    await expect(access(tmpFile)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  // 6. scaffoldOwnedPlugin creates expected directory structure
  it('scaffoldOwnedPlugin creates dir/.claude-plugin/plugin.json and subdirs', async () => {
    const id = pluginId('my-plugin');
    const manifest = makeManifest('my-plugin');

    await cache.scaffoldOwnedPlugin(scope, id, manifest);

    const dir = cache.pluginDir(scope, id);
    const pluginJsonPath = path.join(dir, '.claude-plugin', 'plugin.json');

    // plugin.json exists and is valid JSON
    const pluginJsonRaw = await readFile(pluginJsonPath, 'utf8');
    const pluginJson = JSON.parse(pluginJsonRaw) as Record<string, unknown>;
    expect(pluginJson).toMatchObject({ name: 'my-plugin', version: '1.0.0' });
    expect(pluginJson).not.toHaveProperty('id');
    expect(pluginJson).not.toHaveProperty('artifacts');

    // Expected subdirectories exist
    for (const subdir of ['skills', 'agents', 'commands']) {
      await expect(access(path.join(dir, subdir))).resolves.toBeUndefined();
    }
  });

  // 7. scaffoldOwnedPlugin fails if dir already exists
  it('scaffoldOwnedPlugin throws if directory already exists', async () => {
    const id = pluginId('my-plugin');
    const manifest = makeManifest('my-plugin');

    await cache.scaffoldOwnedPlugin(scope, id, manifest);

    await expect(cache.scaffoldOwnedPlugin(scope, id, manifest)).rejects.toThrow(
      'Cannot scaffold plugin: directory already exists',
    );
  });

  // 8. movePluginDir: file in src appears in dest, src is gone
  it('movePluginDir moves source to destination', async () => {
    const srcDir = path.join(tmpDir, 'src-plugin');
    const destDir = path.join(tmpDir, 'dest-plugin');

    await mkdir(srcDir, { recursive: true });
    await writeFile(path.join(srcDir, 'file.txt'), 'content', 'utf8');

    await cache.movePluginDir(srcDir, destDir);

    // Destination has the file
    const content = await readFile(path.join(destDir, 'file.txt'), 'utf8');
    expect(content).toBe('content');

    // Source no longer exists
    await expect(access(srcDir)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  // 9. movePluginDir fails if dest already exists
  it('movePluginDir throws if destination already exists', async () => {
    const srcDir = path.join(tmpDir, 'src-plugin');
    const destDir = path.join(tmpDir, 'dest-plugin');

    await mkdir(srcDir, { recursive: true });
    await mkdir(destDir, { recursive: true });

    await expect(cache.movePluginDir(srcDir, destDir)).rejects.toThrow(
      'Cannot move plugin dir: destination already exists',
    );
  });

  // 10. removePluginDir removes dir recursively; no error if dir doesn't exist
  it('removePluginDir removes directory recursively', async () => {
    const id = pluginId('my-plugin');
    const manifest = makeManifest('my-plugin');

    await cache.scaffoldOwnedPlugin(scope, id, manifest);
    const dir = cache.pluginDir(scope, id);

    await cache.removePluginDir(scope, id);

    await expect(access(dir)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('removePluginDir does not throw if directory does not exist', async () => {
    const id = pluginId('nonexistent-plugin');
    await expect(cache.removePluginDir(scope, id)).resolves.toBeUndefined();
  });

  // marketplace.json sidecar is kept in sync with _meta.json
  it('writeMeta writes a marketplace.json sidecar derived from meta', async () => {
    const pluginsDir = path.join(tmpDir, scope, 'plugins');
    const id = pluginId('frontend-design');
    await cache.scaffoldOwnedPlugin(scope, id, {
      ...makeManifest('frontend-design'),
      description: 'UI/UX skill',
    });

    await cache.writeMeta(scope, {
      version: 2 as const,
      plugins: [
        {
          id: 'frontend-design',
          origin: 'imported' as const,
          installedAt: '2024-01-01T00:00:00Z',
          scope: 'personal' as const,
          enabled: true,
        },
      ],
    });

    const raw = await readFile(path.join(pluginsDir, '.claude-plugin', 'marketplace.json'), 'utf8');
    expect(JSON.parse(raw)).toEqual({
      name: 'local',
      owner: { name: 'SDE-AI' },
      description: 'Plugins managed by SDE-AI',
      plugins: [
        {
          name: 'frontend-design',
          description: 'UI/UX skill',
          source: './frontend-design',
        },
      ],
    });
  });

  it('writeMeta deletes marketplace.json when meta has no plugins', async () => {
    const pluginsDir = path.join(tmpDir, scope, 'plugins');
    const marketplacePath = path.join(pluginsDir, '.claude-plugin', 'marketplace.json');

    // Seed: one plugin → marketplace.json exists
    const id = pluginId('frontend-design');
    await cache.scaffoldOwnedPlugin(scope, id, makeManifest('frontend-design'));
    await cache.writeMeta(scope, {
      version: 2 as const,
      plugins: [
        {
          id: 'frontend-design',
          origin: 'imported' as const,
          installedAt: '2024-01-01T00:00:00Z',
          scope: 'personal' as const,
          enabled: true,
        },
      ],
    });
    await expect(access(marketplacePath)).resolves.toBeUndefined();

    // Empty meta → marketplace.json removed
    await cache.writeMeta(scope, { version: 2 as const, plugins: [] });
    await expect(access(marketplacePath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('writeMeta uses empty description when plugin.json is missing', async () => {
    const pluginsDir = path.join(tmpDir, scope, 'plugins');

    await cache.writeMeta(scope, {
      version: 2 as const,
      plugins: [
        {
          id: 'orphan-plugin',
          origin: 'imported' as const,
          installedAt: '2024-01-01T00:00:00Z',
          scope: 'personal' as const,
          enabled: true,
        },
      ],
    });

    const raw = await readFile(path.join(pluginsDir, '.claude-plugin', 'marketplace.json'), 'utf8');
    expect(JSON.parse(raw).plugins[0]).toEqual({
      name: 'orphan-plugin',
      description: '',
      source: './orphan-plugin',
    });
  });
});
