import { describe, it, expect } from 'vitest';
import { ClaudePluginAdapter } from '../../../../../src/main/infrastructure/adapters/claude-plugin-adapter.js';
import { FakeClaudeSettingsPort } from '../../../../../src/main/application/services/__fixtures__/fake-claude-settings-port.js';
import type { ClaudeSettings } from '../../../../../src/main/application/schemas/claude-settings.schema.js';
import type { Scope } from '../../../../../src/main/application/ports/scope.js';
import type { PluginId } from '../../../../../src/main/domain/plugin-id.js';

const mockWorkspacePath = (scope: Scope): string => `/workspace/${scope}`;

describe('ClaudePluginAdapter', () => {
  describe('install', () => {
    it('adds marketplace and enables plugin', async () => {
      const settings = new FakeClaudeSettingsPort();
      const adapter = new ClaudePluginAdapter(settings, mockWorkspacePath);
      const scope: Scope = 'personal';
      const pluginId: PluginId = 'test-plugin' as PluginId;

      await adapter.install(scope, pluginId);

      const result = settings.getSettings(scope);
      const marketplace = result.extraKnownMarketplaces['local'];
      expect(marketplace).toBeDefined();
      expect(marketplace!.source.path).toBe('/workspace/personal');
      expect(result.enabledPlugins[`${pluginId}@local`]).toBe(true);
    });

    it('is idempotent - marketplace not duplicated on second install', async () => {
      const settings = new FakeClaudeSettingsPort();
      const adapter = new ClaudePluginAdapter(settings, mockWorkspacePath);
      const scope: Scope = 'personal';
      const pluginId1: PluginId = 'test-plugin-1' as PluginId;
      const pluginId2: PluginId = 'test-plugin-2' as PluginId;

      await adapter.install(scope, pluginId1);
      const afterFirst = settings.getSettings(scope);
      const firstMarketplaceCount = Object.keys(afterFirst.extraKnownMarketplaces).length;

      await adapter.install(scope, pluginId2);
      const afterSecond = settings.getSettings(scope);
      const secondMarketplaceCount = Object.keys(afterSecond.extraKnownMarketplaces).length;

      expect(firstMarketplaceCount).toBe(secondMarketplaceCount);
      expect(secondMarketplaceCount).toBe(1);
      expect(afterSecond.enabledPlugins[`${pluginId1}@local`]).toBe(true);
      expect(afterSecond.enabledPlugins[`${pluginId2}@local`]).toBe(true);
    });
  });

  describe('uninstall', () => {
    it('removes plugin from enabledPlugins and cleans up marketplace if last plugin', async () => {
      const settings = new FakeClaudeSettingsPort();
      const adapter = new ClaudePluginAdapter(settings, mockWorkspacePath);
      const scope: Scope = 'personal';
      const pluginId: PluginId = 'test-plugin' as PluginId;

      // Setup: install the plugin first
      await adapter.install(scope, pluginId);
      const afterInstall = settings.getSettings(scope);
      expect(afterInstall.extraKnownMarketplaces['local']).toBeDefined();

      // Uninstall
      await adapter.uninstall(scope, pluginId);

      const result = settings.getSettings(scope);
      expect(result.enabledPlugins[`${pluginId}@local`]).toBeUndefined();
      expect(result.extraKnownMarketplaces['local']).toBeUndefined();
    });

    it('keeps marketplace when other plugins remain', async () => {
      const settings = new FakeClaudeSettingsPort();
      const adapter = new ClaudePluginAdapter(settings, mockWorkspacePath);
      const scope: Scope = 'personal';
      const pluginId1: PluginId = 'test-plugin-1' as PluginId;
      const pluginId2: PluginId = 'test-plugin-2' as PluginId;

      // Setup: install two plugins
      await adapter.install(scope, pluginId1);
      await adapter.install(scope, pluginId2);

      // Uninstall first plugin
      await adapter.uninstall(scope, pluginId1);

      const result = settings.getSettings(scope);
      expect(result.enabledPlugins[`${pluginId1}@local`]).toBeUndefined();
      expect(result.enabledPlugins[`${pluginId2}@local`]).toBe(true);
      expect(result.extraKnownMarketplaces['local']).toBeDefined();
    });
  });

  describe('toggle', () => {
    it('enables plugin when toggle(true)', async () => {
      const settings = new FakeClaudeSettingsPort();
      const adapter = new ClaudePluginAdapter(settings, mockWorkspacePath);
      const scope: Scope = 'personal';
      const pluginId: PluginId = 'test-plugin' as PluginId;

      // Seed initial settings without the plugin
      const initialSettings: ClaudeSettings = {
        extraKnownMarketplaces: {},
        enabledPlugins: {},
      };
      settings.seedSettings(scope, initialSettings);

      await adapter.toggle(scope, pluginId, true);

      const result = settings.getSettings(scope);
      expect(result.enabledPlugins[`${pluginId}@local`]).toBe(true);
    });

    it('disables plugin when toggle(false)', async () => {
      const settings = new FakeClaudeSettingsPort();
      const adapter = new ClaudePluginAdapter(settings, mockWorkspacePath);
      const scope: Scope = 'personal';
      const pluginId: PluginId = 'test-plugin' as PluginId;

      // Seed initial settings with the plugin enabled
      const initialSettings: ClaudeSettings = {
        extraKnownMarketplaces: {
          'local': {
            source: {
              source: 'directory',
              path: '/workspace/personal',
            },
          },
        },
        enabledPlugins: {
          [`${pluginId}@local`]: true,
        },
      };
      settings.seedSettings(scope, initialSettings);

      await adapter.toggle(scope, pluginId, false);

      const result = settings.getSettings(scope);
      expect(result.enabledPlugins[`${pluginId}@local`]).toBe(false);
    });
  });
});
