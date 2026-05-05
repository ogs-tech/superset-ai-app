import type { ClaudeSettingsPort } from '../../application/ports/claude-settings-port.js';
import type { Scope } from '../../application/ports/scope.js';
import type { PluginId } from '../../domain/plugin-id.js';
import {
  addMarketplaceIfMissing,
  enablePlugin,
  disablePlugin,
  removePlugin,
  cleanupMarketplaceIfEmpty,
} from '../../application/services/claude-settings-mutators.js';

export class ClaudePluginAdapter {
  constructor(
    private readonly settings: ClaudeSettingsPort,
    private readonly getWorkspacePath: (scope: Scope) => string,
  ) {}

  /**
   * Install a plugin: add marketplace if missing and enable the plugin
   * @param scope - The scope (personal or project)
   * @param id - The plugin ID to install
   */
  async install(scope: Scope, id: PluginId): Promise<void> {
    const workspacePath = this.getWorkspacePath(scope);
    await this.settings.mutate(scope, (s) =>
      enablePlugin(addMarketplaceIfMissing(s, workspacePath), id),
    );
  }

  /**
   * Uninstall a plugin: disable, remove from enabledPlugins, and cleanup marketplace if empty
   * @param scope - The scope (personal or project)
   * @param id - The plugin ID to uninstall
   */
  async uninstall(scope: Scope, id: PluginId): Promise<void> {
    await this.settings.mutate(scope, (s) =>
      cleanupMarketplaceIfEmpty(removePlugin(s, id)),
    );
  }

  /**
   * Toggle a plugin enabled/disabled state
   * @param scope - The scope (personal or project)
   * @param id - The plugin ID to toggle
   * @param enabled - Whether to enable (true) or disable (false) the plugin
   */
  async toggle(scope: Scope, id: PluginId, enabled: boolean): Promise<void> {
    await this.settings.mutate(scope, (s) =>
      enabled ? enablePlugin(s, id) : disablePlugin(s, id),
    );
  }
}
