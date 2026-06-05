import type { PluginId } from './plugin-id.js';

export type CustomizationSource = { kind: 'workspace' } | { kind: 'plugin'; pluginId: PluginId };

export const WORKSPACE_SOURCE: CustomizationSource = { kind: 'workspace' };

export function pluginSource(pluginId: PluginId): CustomizationSource {
  return { kind: 'plugin', pluginId };
}

export function isPluginSource(
  source: CustomizationSource,
): source is { kind: 'plugin'; pluginId: PluginId } {
  return source.kind === 'plugin';
}

export function isWorkspaceSource(source: CustomizationSource): source is { kind: 'workspace' } {
  return source.kind === 'workspace';
}
