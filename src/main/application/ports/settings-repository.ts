import type { Settings } from '../../../shared/settings.js';

export interface SettingsRepository {
  load(): Promise<Settings>;
}
