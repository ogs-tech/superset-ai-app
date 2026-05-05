import { describe, it, expect } from 'vitest';
import {
  addMarketplaceIfMissing,
  enablePlugin,
  disablePlugin,
  removePlugin,
  cleanupMarketplaceIfEmpty,
} from '../../../../src/main/application/services/claude-settings-mutators.js';
import type { ClaudeSettings } from '../../../../src/main/application/schemas/claude-settings.schema.js';
import type { PluginId } from '../../../../src/main/domain/plugin-id.js';

const emptySettings = (): ClaudeSettings => ({
  extraKnownMarketplaces: {},
  enabledPlugins: {},
});

const settingsWithMarketplace = (marketplacePath: string): ClaudeSettings => ({
  extraKnownMarketplaces: {
    'skillforge-imports': {
      source: {
        source: 'directory',
        path: marketplacePath,
      },
    },
  },
  enabledPlugins: {},
});

const pluginId = (id: string): PluginId => id as PluginId;

describe('claude-settings-mutators', () => {
  describe('addMarketplaceIfMissing', () => {
    it('adds the skillforge-imports marketplace when absent', () => {
      const settings = emptySettings();
      const path = '/workspace/plugins';

      const result = addMarketplaceIfMissing(settings, path);

      expect(result.extraKnownMarketplaces['skillforge-imports']).toEqual({
        source: {
          source: 'directory',
          path,
        },
      });
    });

    it('returns unchanged settings when marketplace already exists', () => {
      const settings = settingsWithMarketplace('/workspace/plugins');
      const newPath = '/different/path';

      const result = addMarketplaceIfMissing(settings, newPath);

      expect(result).toBe(settings);
      const marketplace = result.extraKnownMarketplaces['skillforge-imports'];
      expect(marketplace).toBeDefined();
      if (marketplace) {
        expect(marketplace.source.path).toBe('/workspace/plugins');
      }
    });

    it('preserves other marketplaces when adding skillforge-imports', () => {
      const settings: ClaudeSettings = {
        extraKnownMarketplaces: {
          'other-marketplace': {
            source: {
              source: 'directory',
              path: '/other/path',
            },
          },
        },
        enabledPlugins: {},
      };

      const result = addMarketplaceIfMissing(settings, '/workspace/plugins');

      expect(result.extraKnownMarketplaces['other-marketplace']).toEqual({
        source: {
          source: 'directory',
          path: '/other/path',
        },
      });
      expect(result.extraKnownMarketplaces['skillforge-imports']).toBeDefined();
    });

    it('preserves other settings properties', () => {
      const settings: ClaudeSettings = {
        extraKnownMarketplaces: {},
        enabledPlugins: {},
        customProperty: 'should-be-preserved',
      } as unknown as ClaudeSettings;

      const result = addMarketplaceIfMissing(settings, '/workspace/plugins');

      expect((result as unknown as Record<string, unknown>).customProperty).toBe(
        'should-be-preserved',
      );
    });

    it('does not mutate the input settings', () => {
      const settings = emptySettings();
      const original = JSON.stringify(settings);

      addMarketplaceIfMissing(settings, '/workspace/plugins');

      expect(JSON.stringify(settings)).toBe(original);
    });
  });

  describe('enablePlugin', () => {
    it('sets enabledPlugins[<id>@skillforge-imports] = true', () => {
      const settings = emptySettings();
      const id = pluginId('my-plugin');

      const result = enablePlugin(settings, id);

      expect(result.enabledPlugins['my-plugin@skillforge-imports']).toBe(true);
    });

    it('creates enabledPlugins object if absent', () => {
      const settings: ClaudeSettings = {
        extraKnownMarketplaces: {},
      } as unknown as ClaudeSettings;
      const id = pluginId('my-plugin');

      const result = enablePlugin(settings, id);

      expect(result.enabledPlugins['my-plugin@skillforge-imports']).toBe(true);
    });

    it('preserves other enabled plugins', () => {
      const settings: ClaudeSettings = {
        extraKnownMarketplaces: {},
        enabledPlugins: {
          'other-plugin@skillforge-imports': true,
          'another@other-marketplace': false,
        },
      };
      const id = pluginId('my-plugin');

      const result = enablePlugin(settings, id);

      expect(result.enabledPlugins['my-plugin@skillforge-imports']).toBe(true);
      expect(result.enabledPlugins['other-plugin@skillforge-imports']).toBe(true);
      expect(result.enabledPlugins['another@other-marketplace']).toBe(false);
    });

    it('overwrites disabled plugin to enabled', () => {
      const settings: ClaudeSettings = {
        extraKnownMarketplaces: {},
        enabledPlugins: {
          'my-plugin@skillforge-imports': false,
        },
      };
      const id = pluginId('my-plugin');

      const result = enablePlugin(settings, id);

      expect(result.enabledPlugins['my-plugin@skillforge-imports']).toBe(true);
    });

    it('does not mutate the input settings', () => {
      const settings = emptySettings();
      const original = JSON.stringify(settings);

      enablePlugin(settings, pluginId('my-plugin'));

      expect(JSON.stringify(settings)).toBe(original);
    });
  });

  describe('disablePlugin', () => {
    it('sets enabledPlugins[<id>@skillforge-imports] = false', () => {
      const settings: ClaudeSettings = {
        extraKnownMarketplaces: {},
        enabledPlugins: {
          'my-plugin@skillforge-imports': true,
        },
      };
      const id = pluginId('my-plugin');

      const result = disablePlugin(settings, id);

      expect(result.enabledPlugins['my-plugin@skillforge-imports']).toBe(false);
    });

    it('no-op when plugin is not in enabledPlugins', () => {
      const settings = emptySettings();
      const id = pluginId('nonexistent');

      const result = disablePlugin(settings, id);

      expect(result).toBe(settings);
    });

    it('preserves other enabled plugins', () => {
      const settings: ClaudeSettings = {
        extraKnownMarketplaces: {},
        enabledPlugins: {
          'my-plugin@skillforge-imports': true,
          'other-plugin@skillforge-imports': true,
        },
      };
      const id = pluginId('my-plugin');

      const result = disablePlugin(settings, id);

      expect(result.enabledPlugins['my-plugin@skillforge-imports']).toBe(false);
      expect(result.enabledPlugins['other-plugin@skillforge-imports']).toBe(true);
    });

    it('does not create entry if plugin does not exist', () => {
      const settings = emptySettings();
      const id = pluginId('my-plugin');

      const result = disablePlugin(settings, id);

      expect('my-plugin@skillforge-imports' in result.enabledPlugins).toBe(false);
    });

    it('does not mutate the input settings', () => {
      const settings: ClaudeSettings = {
        extraKnownMarketplaces: {},
        enabledPlugins: {
          'my-plugin@skillforge-imports': true,
        },
      };
      const original = JSON.stringify(settings);

      disablePlugin(settings, pluginId('my-plugin'));

      expect(JSON.stringify(settings)).toBe(original);
    });
  });

  describe('removePlugin', () => {
    it('removes the plugin key from enabledPlugins', () => {
      const settings: ClaudeSettings = {
        extraKnownMarketplaces: {},
        enabledPlugins: {
          'my-plugin@skillforge-imports': true,
        },
      };
      const id = pluginId('my-plugin');

      const result = removePlugin(settings, id);

      expect('my-plugin@skillforge-imports' in result.enabledPlugins).toBe(false);
    });

    it('no-op when plugin is absent', () => {
      const settings = emptySettings();
      const id = pluginId('nonexistent');

      const result = removePlugin(settings, id);

      expect(result).toBe(settings);
    });

    it('preserves other plugins', () => {
      const settings: ClaudeSettings = {
        extraKnownMarketplaces: {},
        enabledPlugins: {
          'my-plugin@skillforge-imports': true,
          'other-plugin@skillforge-imports': false,
          'another@other-marketplace': true,
        },
      };
      const id = pluginId('my-plugin');

      const result = removePlugin(settings, id);

      expect('my-plugin@skillforge-imports' in result.enabledPlugins).toBe(false);
      expect(result.enabledPlugins['other-plugin@skillforge-imports']).toBe(false);
      expect(result.enabledPlugins['another@other-marketplace']).toBe(true);
    });

    it('does not touch other plugins when removing', () => {
      const settings: ClaudeSettings = {
        extraKnownMarketplaces: {},
        enabledPlugins: {
          'plugin-a@skillforge-imports': true,
          'plugin-b@skillforge-imports': true,
        },
      };

      const result = removePlugin(settings, pluginId('plugin-a'));

      expect(result.enabledPlugins['plugin-b@skillforge-imports']).toBe(true);
    });

    it('does not mutate the input settings', () => {
      const settings: ClaudeSettings = {
        extraKnownMarketplaces: {},
        enabledPlugins: {
          'my-plugin@skillforge-imports': true,
        },
      };
      const original = JSON.stringify(settings);

      removePlugin(settings, pluginId('my-plugin'));

      expect(JSON.stringify(settings)).toBe(original);
    });
  });

  describe('cleanupMarketplaceIfEmpty', () => {
    it('removes the marketplace when last plugin is removed', () => {
      const settings: ClaudeSettings = {
        extraKnownMarketplaces: {
          'skillforge-imports': {
            source: {
              source: 'directory',
              path: '/workspace/plugins',
            },
          },
        },
        enabledPlugins: {},
      };

      const result = cleanupMarketplaceIfEmpty(settings);

      expect('skillforge-imports' in result.extraKnownMarketplaces).toBe(false);
    });

    it('keeps the marketplace when other skillforge plugins still exist', () => {
      const settings: ClaudeSettings = {
        extraKnownMarketplaces: {
          'skillforge-imports': {
            source: {
              source: 'directory',
              path: '/workspace/plugins',
            },
          },
        },
        enabledPlugins: {
          'my-plugin@skillforge-imports': true,
        },
      };

      const result = cleanupMarketplaceIfEmpty(settings);

      expect(result.extraKnownMarketplaces['skillforge-imports']).toBeDefined();
    });

    it('keeps the marketplace when disabled skillforge plugins exist', () => {
      const settings: ClaudeSettings = {
        extraKnownMarketplaces: {
          'skillforge-imports': {
            source: {
              source: 'directory',
              path: '/workspace/plugins',
            },
          },
        },
        enabledPlugins: {
          'my-plugin@skillforge-imports': false,
        },
      };

      const result = cleanupMarketplaceIfEmpty(settings);

      expect(result.extraKnownMarketplaces['skillforge-imports']).toBeDefined();
    });

    it('is no-op when marketplace never existed', () => {
      const settings = emptySettings();
      const original = JSON.stringify(settings);

      const result = cleanupMarketplaceIfEmpty(settings);

      expect(result).toBe(settings);
      expect(JSON.stringify(result)).toBe(original);
    });

    it('preserves other marketplaces when cleaning up skillforge', () => {
      const settings: ClaudeSettings = {
        extraKnownMarketplaces: {
          'skillforge-imports': {
            source: {
              source: 'directory',
              path: '/workspace/plugins',
            },
          },
          'other-marketplace': {
            source: {
              source: 'directory',
              path: '/other/path',
            },
          },
        },
        enabledPlugins: {},
      };

      const result = cleanupMarketplaceIfEmpty(settings);

      expect('skillforge-imports' in result.extraKnownMarketplaces).toBe(false);
      expect(result.extraKnownMarketplaces['other-marketplace']).toBeDefined();
    });

    it('does not mutate the input settings', () => {
      const settings: ClaudeSettings = {
        extraKnownMarketplaces: {
          'skillforge-imports': {
            source: {
              source: 'directory',
              path: '/workspace/plugins',
            },
          },
        },
        enabledPlugins: {},
      };
      const original = JSON.stringify(settings);

      cleanupMarketplaceIfEmpty(settings);

      expect(JSON.stringify(settings)).toBe(original);
    });

    it('handles edge case: only non-skillforge plugins exist', () => {
      const settings: ClaudeSettings = {
        extraKnownMarketplaces: {
          'skillforge-imports': {
            source: {
              source: 'directory',
              path: '/workspace/plugins',
            },
          },
        },
        enabledPlugins: {
          'my-plugin@other-marketplace': true,
        },
      };

      const result = cleanupMarketplaceIfEmpty(settings);

      expect('skillforge-imports' in result.extraKnownMarketplaces).toBe(false);
    });
  });

  describe('per-marketplace attribution', () => {
    it('enablePlugin uses provided marketplaceId in the key', () => {
      const result = enablePlugin(emptySettings(), pluginId('feature-dev'), 'claude-plugins-official');
      expect(result.enabledPlugins['feature-dev@claude-plugins-official']).toBe(true);
      expect(result.enabledPlugins['feature-dev@skillforge-imports']).toBeUndefined();
    });

    it('disablePlugin targets the per-marketplace key', () => {
      const settings: ClaudeSettings = {
        extraKnownMarketplaces: {},
        enabledPlugins: {
          'feature-dev@claude-plugins-official': true,
          'feature-dev@skillforge-imports': true,
        },
      };
      const result = disablePlugin(settings, pluginId('feature-dev'), 'claude-plugins-official');
      expect(result.enabledPlugins['feature-dev@claude-plugins-official']).toBe(false);
      // skillforge-imports key untouched
      expect(result.enabledPlugins['feature-dev@skillforge-imports']).toBe(true);
    });

    it('removePlugin removes only the per-marketplace key', () => {
      const settings: ClaudeSettings = {
        extraKnownMarketplaces: {},
        enabledPlugins: {
          'feature-dev@claude-plugins-official': true,
          'feature-dev@skillforge-imports': true,
        },
      };
      const result = removePlugin(settings, pluginId('feature-dev'), 'claude-plugins-official');
      expect('feature-dev@claude-plugins-official' in result.enabledPlugins).toBe(false);
      expect(result.enabledPlugins['feature-dev@skillforge-imports']).toBe(true);
    });

    it('cleanupMarketplaceIfEmpty does NOT remove non-skillforge marketplaces (we never registered them)', () => {
      const settings: ClaudeSettings = {
        extraKnownMarketplaces: {
          'claude-plugins-official': {
            source: { source: 'github', repo: 'anthropics/claude-plugins-official' },
          } as never,
        },
        enabledPlugins: {},
      };
      const result = cleanupMarketplaceIfEmpty(settings);
      expect(result.extraKnownMarketplaces['claude-plugins-official']).toBeDefined();
    });
  });

  describe('integration scenarios', () => {
    it('add marketplace, enable plugin, disable plugin, remove plugin flow', () => {
      let settings = emptySettings();

      // Add marketplace
      settings = addMarketplaceIfMissing(settings, '/workspace/plugins');
      expect('skillforge-imports' in settings.extraKnownMarketplaces).toBe(true);

      // Enable plugin
      settings = enablePlugin(settings, pluginId('my-plugin'));
      expect(settings.enabledPlugins['my-plugin@skillforge-imports']).toBe(true);

      // Disable plugin
      settings = disablePlugin(settings, pluginId('my-plugin'));
      expect(settings.enabledPlugins['my-plugin@skillforge-imports']).toBe(false);

      // Remove plugin
      settings = removePlugin(settings, pluginId('my-plugin'));
      expect('my-plugin@skillforge-imports' in settings.enabledPlugins).toBe(false);

      // Cleanup marketplace
      settings = cleanupMarketplaceIfEmpty(settings);
      expect('skillforge-imports' in settings.extraKnownMarketplaces).toBe(false);
    });

    it('manage multiple plugins concurrently', () => {
      let settings = emptySettings();
      settings = addMarketplaceIfMissing(settings, '/workspace/plugins');

      // Enable multiple plugins
      settings = enablePlugin(settings, pluginId('plugin-a'));
      settings = enablePlugin(settings, pluginId('plugin-b'));
      settings = enablePlugin(settings, pluginId('plugin-c'));

      expect(settings.enabledPlugins['plugin-a@skillforge-imports']).toBe(true);
      expect(settings.enabledPlugins['plugin-b@skillforge-imports']).toBe(true);
      expect(settings.enabledPlugins['plugin-c@skillforge-imports']).toBe(true);
      expect('skillforge-imports' in settings.extraKnownMarketplaces).toBe(true);

      // Disable one plugin
      settings = disablePlugin(settings, pluginId('plugin-b'));
      expect(settings.enabledPlugins['plugin-b@skillforge-imports']).toBe(false);
      expect('skillforge-imports' in settings.extraKnownMarketplaces).toBe(true);

      // Remove all plugins
      settings = removePlugin(settings, pluginId('plugin-a'));
      settings = removePlugin(settings, pluginId('plugin-b'));
      settings = removePlugin(settings, pluginId('plugin-c'));

      expect(Object.keys(settings.enabledPlugins).length).toBe(0);

      // Cleanup marketplace
      settings = cleanupMarketplaceIfEmpty(settings);
      expect('skillforge-imports' in settings.extraKnownMarketplaces).toBe(false);
    });
  });
});
