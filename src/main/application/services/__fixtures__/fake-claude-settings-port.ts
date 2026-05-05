import type { ClaudeSettingsPort } from '../../ports/claude-settings-port.js';
import type { PluginId } from '../../../domain/plugin-id.js';
import type { ClaudeSettings } from '../../schemas/claude-settings.schema.js';
import type { Scope } from '../../ports/scope.js';

const DEFAULT_SETTINGS: ClaudeSettings = {
  extraKnownMarketplaces: {},
  enabledPlugins: {},
};

export class FakeClaudeSettingsPort implements ClaudeSettingsPort {
  private settings: Map<string, ClaudeSettings> = new Map();
  private symlinks: Map<string, string> = new Map();

  seedSettings(scope: Scope, s: ClaudeSettings): void {
    this.settings.set(scope, s);
  }

  getSettings(scope: Scope): ClaudeSettings {
    return this.settings.get(scope) ?? { ...DEFAULT_SETTINGS };
  }

  getSymlinks(): Map<string, string> {
    return this.symlinks;
  }

  async mutate(scope: Scope, mutator: (s: ClaudeSettings) => ClaudeSettings): Promise<void> {
    const current = this.settings.get(scope) ?? { ...DEFAULT_SETTINGS };
    this.settings.set(scope, mutator(current));
  }

  async read(scope: Scope): Promise<ClaudeSettings> {
    return this.settings.get(scope) ?? { ...DEFAULT_SETTINGS };
  }

  async symlink(scope: Scope, id: PluginId, target: string): Promise<void> {
    this.symlinks.set(`${scope}/${id}`, target);
  }

  async unlink(scope: Scope, id: PluginId): Promise<void> {
    this.symlinks.delete(`${scope}/${id}`);
  }
}
