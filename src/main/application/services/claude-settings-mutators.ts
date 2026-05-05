import type { ClaudeSettings } from '../schemas/claude-settings.schema.js';
import type { PluginId } from '../../domain/plugin-id.js';

export const SKILLFORGE_MARKETPLACE = 'skillforge-imports';

/**
 * Adds the skillforge-imports synthetic marketplace to settings if absent. Used
 * only for plugins this app owns (authored locally) or imported via raw URL,
 * where there is no upstream marketplace registered with Claude Code. For
 * plugins installed from a known marketplace (e.g. claude-plugins-official)
 * the marketplace is assumed to already be registered by the user/Claude.
 */
export function addMarketplaceIfMissing(s: ClaudeSettings, marketplacePath: string): ClaudeSettings {
  if (s.extraKnownMarketplaces?.[SKILLFORGE_MARKETPLACE]) {
    return s;
  }

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
 * Sets enabledPlugins['<id>@<marketplaceId>'] = true. When marketplaceId is
 * omitted, defaults to skillforge-imports for back-compat.
 */
export function enablePlugin(
  s: ClaudeSettings,
  id: PluginId,
  marketplaceId: string = SKILLFORGE_MARKETPLACE,
): ClaudeSettings {
  const pluginKey = `${id}@${marketplaceId}`;

  return {
    ...s,
    enabledPlugins: {
      ...s.enabledPlugins,
      [pluginKey]: true,
    },
  };
}

/**
 * Sets enabledPlugins['<id>@<marketplaceId>'] = false. No-op if the key is
 * absent.
 */
export function disablePlugin(
  s: ClaudeSettings,
  id: PluginId,
  marketplaceId: string = SKILLFORGE_MARKETPLACE,
): ClaudeSettings {
  const pluginKey = `${id}@${marketplaceId}`;

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
 * Removes the '<id>@<marketplaceId>' key from enabledPlugins entirely.
 */
export function removePlugin(
  s: ClaudeSettings,
  id: PluginId,
  marketplaceId: string = SKILLFORGE_MARKETPLACE,
): ClaudeSettings {
  const pluginKey = `${id}@${marketplaceId}`;

  if (!(pluginKey in s.enabledPlugins)) {
    return s;
  }

  const newEnabledPlugins = { ...s.enabledPlugins };
  delete newEnabledPlugins[pluginKey];

  return {
    ...s,
    enabledPlugins: newEnabledPlugins,
  };
}

/**
 * Removes 'skillforge-imports' from extraKnownMarketplaces if no plugin is
 * still attributed to it. Other marketplaces are left untouched (we did not
 * register them).
 */
export function cleanupMarketplaceIfEmpty(s: ClaudeSettings): ClaudeSettings {
  const hasSkillforgePlugin = Object.keys(s.enabledPlugins).some((key) =>
    key.endsWith(`@${SKILLFORGE_MARKETPLACE}`),
  );

  if (hasSkillforgePlugin) {
    return s;
  }

  if (!(SKILLFORGE_MARKETPLACE in s.extraKnownMarketplaces)) {
    return s;
  }

  const newMarketplaces = { ...s.extraKnownMarketplaces };
  delete newMarketplaces[SKILLFORGE_MARKETPLACE];

  return {
    ...s,
    extraKnownMarketplaces: newMarketplaces,
  };
}
