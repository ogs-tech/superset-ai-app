import type { Settings } from '../../../shared/settings.js';
import type { SettingsRepository } from '../../application/ports/settings-repository.js';

const DEFAULT_SETTINGS: Settings = {
  workspacePath: '~/sde-ai-app',
  adapters: {
    claude: { enabled: false, defaultScope: 'personal' },
    copilot: { enabled: false, defaultScope: 'personal' },
  },
  linkedRepos: [],
  ui: { theme: 'system' },
};

export class InMemorySettingsRepository implements SettingsRepository {
  load(): Promise<Settings> {
    return Promise.resolve(structuredClone(DEFAULT_SETTINGS));
  }
}
