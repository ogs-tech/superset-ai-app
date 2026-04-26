import { describe, expect, it } from 'vitest';
import { SettingsService } from '../../../src/main/application/services/settings-service.js';
import type { SettingsRepository } from '../../../src/main/application/ports/settings-repository.js';
import { DomainError } from '../../../src/main/domain/errors.js';
import type { Settings } from '../../../src/shared/settings.js';

const sampleSettings: Settings = {
  workspacePath: '/tmp/sample',
  adapters: {
    claude: { enabled: true, defaultScope: 'personal' },
    copilot: { enabled: false, defaultScope: 'personal' },
  },
  linkedRepos: [],
  ui: { theme: 'system' },
};

const repoReturning = (settings: Settings): SettingsRepository => ({
  load: () => Promise.resolve(settings),
});

const repoThrowing = (err: unknown): SettingsRepository => ({
  load: () => Promise.reject(err),
});

describe('SettingsService', () => {
  it('get() returns the object produced by repo.load()', async () => {
    const service = new SettingsService(repoReturning(sampleSettings));

    const result = await service.get();

    expect(result).toBe(sampleSettings);
  });

  it('get() propagates DomainError from the repo without swallowing it', async () => {
    const domainErr = new DomainError('io', 'disk on fire', { path: '/x' });
    const service = new SettingsService(repoThrowing(domainErr));

    await expect(service.get()).rejects.toBe(domainErr);
  });
});
