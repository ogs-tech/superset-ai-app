import type { ClaudeSettings } from '../schemas/claude-settings.schema.js';
import type { PluginId } from '../../domain/plugin-id.js';

const SKILLFORGE_MARKETPLACE = 'skillforge-imports';

/**
 * Adds the skillforge-imports marketplace to settings if not already present
 * @param s - The current ClaudeSettings
 * @param marketplacePath - The workspace/plugins directory path
 * @returns A new ClaudeSettings object with the marketplace added (or unchanged if already present)
 */
export function addMarketplaceIfMissing(s: ClaudeSettings, marketplacePath: string): ClaudeSettings {
  // If marketplace already exists, return unchanged
  if (s.extraKnownMarketplaces?.[SKILLFORGE_MARKETPLACE]) {
    return s;
  }

  // Create new settings with the marketplace added
  return {
    ...s,
    extraKnownMarketplaces: {
      ...s.extraKnownMarketplaces,
      [SKILLFORGE_MARKETPLACE]: {
        source: {
          source: 'directory',
          path: marketplacePath,
        },
      },
    },
  };
}

/**
 * Enables a plugin by setting enabledPlugins['<id>@skillforge-imports'] = true
 * @param s - The current ClaudeSettings
 * @param id - The PluginId to enable
 * @returns A new ClaudeSettings object with the plugin enabled
 */
export function enablePlugin(s: ClaudeSettings, id: PluginId): ClaudeSettings {
  const pluginKey = `${id}@${SKILLFORGE_MARKETPLACE}`;

  return {
    ...s,
    enabledPlugins: {
      ...s.enabledPlugins,
      [pluginKey]: true,
    },
  };
}

/**
 * Disables a plugin by setting enabledPlugins['<id>@skillforge-imports'] = false
 * @param s - The current ClaudeSettings
 * @param id - The PluginId to disable
 * @returns A new ClaudeSettings object with the plugin disabled
 */
export function disablePlugin(s: ClaudeSettings, id: PluginId): ClaudeSettings {
  const pluginKey = `${id}@${SKILLFORGE_MARKETPLACE}`;

  // If the plugin is not in enabledPlugins, return unchanged (no-op)
  if (!(pluginKey in s.enabledPlugins)) {
    return s;
  }

  return {
    ...s,
    enabledPlugins: {
      ...s.enabledPlugins,
      [pluginKey]: false,
    },
  };
}

/**
 * Removes a plugin entirely from enabledPlugins by deleting its key
 * @param s - The current ClaudeSettings
 * @param id - The PluginId to remove
 * @returns A new ClaudeSettings object with the plugin removed
 */
export function removePlugin(s: ClaudeSettings, id: PluginId): ClaudeSettings {
  const pluginKey = `${id}@${SKILLFORGE_MARKETPLACE}`;

  // If the plugin is not in enabledPlugins, return unchanged (no-op)
  if (!(pluginKey in s.enabledPlugins)) {
    return s;
  }

  // Remove the plugin key from enabledPlugins
  const newEnabledPlugins = { ...s.enabledPlugins };
  delete newEnabledPlugins[pluginKey];

  return {
    ...s,
    enabledPlugins: newEnabledPlugins,
  };
}

/**
 * If no plugins remain in enabledPlugins that belong to skillforge-imports,
 * removes the 'skillforge-imports' key from extraKnownMarketplaces
 * @param s - The current ClaudeSettings
 * @returns A new ClaudeSettings object with the marketplace cleaned up if empty
 */
export function cleanupMarketplaceIfEmpty(s: ClaudeSettings): ClaudeSettings {
  // Check if any key in enabledPlugins ends with @skillforge-imports
  const hasSkillforgePlugin = Object.keys(s.enabledPlugins).some((key) =>
    key.endsWith(`@${SKILLFORGE_MARKETPLACE}`),
  );

  // If there are still skillforge plugins, no cleanup needed
  if (hasSkillforgePlugin) {
    return s;
  }

  // If marketplace doesn't exist, no cleanup needed
  if (!(SKILLFORGE_MARKETPLACE in s.extraKnownMarketplaces)) {
    return s;
  }

  // Remove the marketplace from extraKnownMarketplaces
  const newMarketplaces = { ...s.extraKnownMarketplaces };
  delete newMarketplaces[SKILLFORGE_MARKETPLACE];

  return {
    ...s,
    extraKnownMarketplaces: newMarketplaces,
  };
}
