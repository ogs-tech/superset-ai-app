import type { PluginId } from '../../domain/plugin-id.js';

/**
 * A single plugin installed directly by Claude Code (`~/.claude/plugins/`).
 * `installPath` points verbatim at the plugin content; it is used as-is and is
 * never reconstructed from id/version.
 */
export interface ClaudeCodePluginDescriptor {
  pluginId: PluginId;
  marketplace: string;
  installPath: string;
  version: string;
  scope: 'user';
}

export interface ClaudeCodePluginRegistryPort {
  list(): Promise<ClaudeCodePluginDescriptor[]>;
}
