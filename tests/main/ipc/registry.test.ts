import { describe, expect, it } from 'vitest';
import { buildHandlers } from '../../../src/main/ipc/registry.js';
import { SettingsService } from '../../../src/main/application/services/settings-service.js';
import type { Settings } from '../../../src/shared/settings.js';

const fakeSettings: Settings = {
  workspacePath: '/tmp',
  adapters: {
    claude: { enabled: false, defaultScope: 'personal' },
    copilot: { enabled: false, defaultScope: 'personal' },
  },
  linkedRepos: [],
  ui: { theme: 'system' },
};

describe('buildHandlers', () => {
  it('registers settings.get and delegates to SettingsService', async () => {
    const settingsService = new SettingsService({
      load: () => Promise.resolve(fakeSettings),
    });
    const handlers = buildHandlers({ settingsService });

    expect(handlers).toHaveProperty('settings.get');
    const result = await handlers['settings.get']?.({});
    expect(result).toBe(fakeSettings);
  });
});
