import type { Settings } from '../../../shared/settings.js';
import type { SettingsRepository } from '../../application/ports/settings-repository.js';

export class InMemorySettingsRepository implements SettingsRepository {
  private state: Settings | null = null;

  load(): Promise<Settings | null> {
    return Promise.resolve(this.state == null ? null : structuredClone(this.state));
  }

  save(settings: Settings): Promise<void> {
    this.state = structuredClone(settings);
    return Promise.resolve();
  }
}
