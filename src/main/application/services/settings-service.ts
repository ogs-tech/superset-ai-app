import type { Settings } from '../../../shared/settings.js';
import type { SettingsRepository } from '../ports/settings-repository.js';

export class SettingsService {
  constructor(private readonly repository: SettingsRepository) {}

  get(): Promise<Settings> {
    return this.repository.load();
  }
}
