import type { SettingsService } from '../application/services/settings-service.js';
import type { IpcHandlers } from './dispatcher.js';

export interface IpcDeps {
  settingsService: SettingsService;
}

export function buildHandlers({ settingsService }: IpcDeps): IpcHandlers {
  return {
    'settings.get': () => settingsService.get(),
  };
}
