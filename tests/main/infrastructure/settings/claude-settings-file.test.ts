import { mkdtemp, readFile, rm, stat, lstat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ClaudeSettingsFile } from '../../../../src/main/infrastructure/settings/claude-settings-file.js';
import type { Scope } from '../../../../src/main/application/ports/scope.js';
import type { PluginId } from '../../../../src/main/domain/plugin-id.js';

function makeAdapter(tmpDir: string) {
  return new ClaudeSettingsFile({
    settingsPath(scope: Scope): string {
      return path.join(tmpDir, scope, 'settings.json');
    },
    symlinkPath(scope: Scope, id: PluginId): string {
      return path.join(tmpDir, scope, 'plugins', 'cache', 'local', id);
    },
  });
}

describe('ClaudeSettingsFile', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'claude-settings-file-test-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe('read', () => {
    it('returns defaults when settings file does not exist', async () => {
      const adapter = makeAdapter(tmpDir);
      const result = await adapter.read('personal');
      expect(result).toEqual({
        extraKnownMarketplaces: {},
        enabledPlugins: {},
      });
    });
  });

  describe('mutate', () => {
    it('applies mutator and persists to file, readable afterwards', async () => {
      const adapter = makeAdapter(tmpDir);
      await adapter.mutate('personal', (s) => ({
        ...s,
        extraKnownMarketplaces: {
          'my-market': { source: { source: 'directory', path: '/some/path' } },
        },
      }));

      const result = await adapter.read('personal');
      expect(result.extraKnownMarketplaces).toEqual({
        'my-market': { source: { source: 'directory', path: '/some/path' } },
      });
    });

    it('creates a .bak file containing original content before mutation', async () => {
      const adapter = makeAdapter(tmpDir);
      const settingsPath = path.join(tmpDir, 'personal', 'settings.json');

      // First mutate to create initial content
      await adapter.mutate('personal', (s) => ({
        ...s,
        enabledPlugins: { 'plugin-a': true },
      }));

      const originalContent = await readFile(settingsPath, 'utf8');

      // Second mutate triggers backup
      await adapter.mutate('personal', (s) => ({
        ...s,
        enabledPlugins: { 'plugin-a': true, 'plugin-b': false },
      }));

      const bakContent = await readFile(settingsPath + '.bak', 'utf8');
      expect(bakContent).toBe(originalContent);
    });

    it('cleans up tmp file after successful mutate', async () => {
      const adapter = makeAdapter(tmpDir);
      const settingsPath = path.join(tmpDir, 'personal', 'settings.json');

      await adapter.mutate('personal', (s) => s);

      await expect(stat(settingsPath + '.tmp')).rejects.toThrow();
    });
  });

  describe('symlink', () => {
    it('creates a symlink at symlinkPath pointing to the given target', async () => {
      const adapter = makeAdapter(tmpDir);
      const targetDir = path.join(tmpDir, 'target-plugin-dir');
      const linkPath = path.join(
        tmpDir,
        'personal',
        'plugins',
        'cache',
        'local',
        'my-plugin' as PluginId,
      );

      await adapter.symlink('personal', 'my-plugin' as PluginId, targetDir);

      const linkStat = await lstat(linkPath);
      expect(linkStat.isSymbolicLink()).toBe(true);
    });

    it('replaces an existing symlink without error', async () => {
      const adapter = makeAdapter(tmpDir);
      const target1 = path.join(tmpDir, 'target-1');
      const target2 = path.join(tmpDir, 'target-2');
      const id = 'my-plugin' as PluginId;

      await adapter.symlink('personal', id, target1);
      // Should not throw
      await expect(adapter.symlink('personal', id, target2)).resolves.toBeUndefined();

      const linkPath = path.join(
        tmpDir,
        'personal',
        'plugins',
        'cache',
        'local',
        id,
      );
      const linkStat = await lstat(linkPath);
      expect(linkStat.isSymbolicLink()).toBe(true);
    });
  });

  describe('unlink', () => {
    it('removes an existing symlink', async () => {
      const adapter = makeAdapter(tmpDir);
      const id = 'my-plugin' as PluginId;
      const targetDir = path.join(tmpDir, 'target-plugin-dir');
      const linkPath = path.join(
        tmpDir,
        'personal',
        'plugins',
        'cache',
        'local',
        id,
      );

      await adapter.symlink('personal', id, targetDir);
      await adapter.unlink('personal', id);

      await expect(lstat(linkPath)).rejects.toThrow();
    });

    it('does not throw when symlink does not exist', async () => {
      const adapter = makeAdapter(tmpDir);
      await expect(
        adapter.unlink('personal', 'nonexistent-plugin' as PluginId),
      ).resolves.toBeUndefined();
    });
  });
});
