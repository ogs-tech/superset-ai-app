import { describe, it, expect } from 'vitest';
import { HookService } from '../../../../src/main/application/services/hook-service.js';
import { FakeClaudeSettingsPort } from '../../../../src/main/application/services/__fixtures__/fake-claude-settings-port.js';
import { FakePluginCachePort } from '../../../../src/main/application/services/__fixtures__/fake-plugin-cache-port.js';
import { InMemoryFileSystem } from '../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';
import { OperationNotAllowedForOriginError } from '../../../../src/main/domain/plugin-errors.js';
import { hookId } from '../../../../src/main/domain/hook-id.js';
import type { PluginId } from '../../../../src/main/domain/plugin-id.js';

describe('HookService', () => {
  describe('save / list (workspace)', () => {
    it('creates a workspace hook and lists it', async () => {
      const settings = new FakeClaudeSettingsPort();
      const service = new HookService(settings);

      const result = await service.save({
        hook: {
          event: 'SessionStart',
          matcher: 'startup',
          handler: { type: 'command', command: 'echo hello' },
        },
      });

      expect(result.hook.event).toBe('SessionStart');
      expect(result.hook.matcher).toBe('startup');
      expect(result.hook.source.kind).toBe('workspace');
      expect(typeof result.hook.id).toBe('string');

      const listed = await service.list('personal');
      expect(listed).toHaveLength(1);
      expect(listed[0]?.id).toBe(result.hook.id);
    });

    it('writes _sdeAiId discriminator into settings.json hooks entry', async () => {
      const settings = new FakeClaudeSettingsPort();
      const service = new HookService(settings);

      const { hook } = await service.save({
        hook: {
          event: 'PreToolUse',
          matcher: 'Bash',
          handler: { type: 'command', command: 'echo foo' },
        },
      });

      const persisted = settings.getSettings('personal');
      const block = persisted.hooks?.['PreToolUse']?.[0];
      expect(block?.matcher).toBe('Bash');
      const handler = block?.hooks[0] as { _sdeAiId?: string; command?: string };
      expect(handler?._sdeAiId).toBe(hook.id);
      expect(handler?.command).toBe('echo foo');
    });

    it('updates an existing hook by id (no duplication)', async () => {
      const settings = new FakeClaudeSettingsPort();
      const service = new HookService(settings);

      const { hook } = await service.save({
        hook: {
          event: 'SessionStart',
          handler: { type: 'command', command: 'echo old' },
        },
      });

      await service.save({
        hook: {
          id: hook.id,
          event: 'SessionStart',
          handler: { type: 'command', command: 'echo new' },
        },
      });

      const listed = await service.list('personal');
      expect(listed).toHaveLength(1);
      const handler = listed[0]?.handler as { command?: string };
      expect(handler.command).toBe('echo new');
    });

    it('moves hook to a different event when event field changes', async () => {
      const settings = new FakeClaudeSettingsPort();
      const service = new HookService(settings);

      const { hook } = await service.save({
        hook: {
          event: 'SessionStart',
          handler: { type: 'command', command: 'echo x' },
        },
      });

      await service.save({
        hook: {
          id: hook.id,
          event: 'Stop',
          handler: { type: 'command', command: 'echo x' },
        },
      });

      const persisted = settings.getSettings('personal');
      expect(persisted.hooks?.['SessionStart']).toBeUndefined();
      expect(persisted.hooks?.['Stop']).toHaveLength(1);
    });

    it('preserves hooks added directly to settings.json without _sdeAiId', async () => {
      const settings = new FakeClaudeSettingsPort();
      settings.seedSettings('personal', {
        extraKnownMarketplaces: {},
        enabledPlugins: {},
        hooks: {
          SessionStart: [
            { matcher: 'startup', hooks: [{ type: 'command', command: 'manual' }] },
          ],
        },
      });
      const service = new HookService(settings);

      const listed = await service.list('personal');
      expect(listed).toHaveLength(1);
      const handler = listed[0]?.handler as { command?: string };
      expect(handler.command).toBe('manual');
      // synthetic id is generated for unmarked entries; still lists as workspace
      expect(listed[0]?.source.kind).toBe('workspace');
    });
  });

  describe('delete', () => {
    it('removes the workspace hook from settings.json', async () => {
      const settings = new FakeClaudeSettingsPort();
      const service = new HookService(settings);

      const { hook } = await service.save({
        hook: {
          event: 'SessionStart',
          handler: { type: 'command', command: 'echo x' },
        },
      });

      await service.delete({ id: hook.id });

      const persisted = settings.getSettings('personal');
      expect(persisted.hooks?.['SessionStart']).toBeUndefined();
      const listed = await service.list('personal');
      expect(listed).toHaveLength(0);
    });
  });

  describe('plugin hooks (read-only discovery)', () => {
    it('lists hooks from installed plugins via hooks/hooks.json', async () => {
      const settings = new FakeClaudeSettingsPort();
      const cache = new FakePluginCachePort();
      const fs = new InMemoryFileSystem();
      const pid = 'superpowers' as PluginId;
      cache.seedMeta('personal', {
        version: 2,
        plugins: [
          {
            id: pid,
            origin: 'imported',
            installedAt: '2026-05-04T14:30:00Z',
            scope: 'personal',
            enabled: true,
          },
        ],
      });
      fs.createFile(
        `${cache.pluginDir('personal', pid)}/hooks/hooks.json`,
        JSON.stringify({
          hooks: {
            SessionStart: [
              {
                matcher: 'startup|clear|compact',
                hooks: [{ type: 'command', command: 'run-hook session-start' }],
              },
            ],
          },
        }),
      );
      const service = new HookService(settings, { cache, fs });

      const listed = await service.list('personal');
      expect(listed).toHaveLength(1);
      expect(listed[0]?.event).toBe('SessionStart');
      expect(listed[0]?.matcher).toBe('startup|clear|compact');
      expect(listed[0]?.source).toEqual({ kind: 'plugin', pluginId: pid });
      expect(listed[0]?.id.startsWith('superpowers:SessionStart:')).toBe(true);
    });

    it('blocks save for plugin-sourced hook ids', async () => {
      const settings = new FakeClaudeSettingsPort();
      const cache = new FakePluginCachePort();
      const fs = new InMemoryFileSystem();
      const pid = 'superpowers' as PluginId;
      cache.seedMeta('personal', {
        version: 2,
        plugins: [
          {
            id: pid,
            origin: 'imported',
            installedAt: '2026-05-04T14:30:00Z',
            scope: 'personal',
            enabled: true,
          },
        ],
      });
      fs.createFile(
        `${cache.pluginDir('personal', pid)}/hooks/hooks.json`,
        JSON.stringify({
          hooks: {
            SessionStart: [
              { matcher: 'x', hooks: [{ type: 'command', command: 'cmd' }] },
            ],
          },
        }),
      );
      const service = new HookService(settings, { cache, fs });

      const listed = await service.list('personal');
      const pluginHook = listed[0];
      if (!pluginHook) throw new Error('expected one plugin hook');

      await expect(
        service.save({
          hook: {
            id: hookId(pluginHook.id),
            event: 'SessionStart',
            handler: { type: 'command', command: 'evil' },
          },
        }),
      ).rejects.toBeInstanceOf(OperationNotAllowedForOriginError);
    });

    it('blocks delete for plugin-sourced hook ids', async () => {
      const settings = new FakeClaudeSettingsPort();
      const cache = new FakePluginCachePort();
      const fs = new InMemoryFileSystem();
      const pid = 'superpowers' as PluginId;
      cache.seedMeta('personal', {
        version: 2,
        plugins: [
          {
            id: pid,
            origin: 'imported',
            installedAt: '2026-05-04T14:30:00Z',
            scope: 'personal',
            enabled: true,
          },
        ],
      });
      fs.createFile(
        `${cache.pluginDir('personal', pid)}/hooks/hooks.json`,
        JSON.stringify({
          hooks: {
            SessionStart: [
              { matcher: 'x', hooks: [{ type: 'command', command: 'cmd' }] },
            ],
          },
        }),
      );
      const service = new HookService(settings, { cache, fs });

      const listed = await service.list('personal');
      const pluginHook = listed[0];
      if (!pluginHook) throw new Error('expected one plugin hook');

      await expect(
        service.delete({ id: hookId(pluginHook.id) }),
      ).rejects.toBeInstanceOf(OperationNotAllowedForOriginError);
    });
  });
});
