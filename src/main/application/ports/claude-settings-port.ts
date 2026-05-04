import type { PluginId } from '../../domain/plugin-id.js';
import type { ClaudeSettings } from '../schemas/claude-settings.schema.js';
import type { Scope } from './scope.js';

export interface ClaudeSettingsPort {
  mutate(scope: Scope, mutator: (s: ClaudeSettings) => ClaudeSettings): Promise<void>;
  read(scope: Scope): Promise<ClaudeSettings>;
  symlink(scope: Scope, id: PluginId, target: string): Promise<void>;
  unlink(scope: Scope, id: PluginId): Promise<void>;
}
