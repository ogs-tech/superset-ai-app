import { describe, it, expect, vi } from 'vitest';
import { InMemoryCustomizationRepository } from '../../../../../src/main/infrastructure/customization/in-memory-customization-repository.js';
import { InMemorySettingsRepository } from '../../../../../src/main/infrastructure/settings/in-memory-settings-repository.js';
import { InMemoryFileSystem } from '../../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';
import { FixedClock } from '../../../../../src/main/infrastructure/clock/fixed-clock.js';
import { SymlinkManager } from '../../../../../src/main/application/services/symlink-manager.js';
import { AdapterManager } from '../../../../../src/main/application/services/adapter-manager.js';
import { SettingsService } from '../../../../../src/main/application/services/settings-service.js';
import type { Settings } from '../../../../../src/shared/settings.js';

const baseSettings: Settings = {
  adapters: { claude: { enabled: true } },
  linkedRepos: [],
  ui: { theme: 'system' },
  language: 'off',
};

const setup = async () => {
  const repo = new InMemorySettingsRepository();
  await repo.save(baseSettings);
  const settingsService = new SettingsService(repo);
  const customizationRepo = new InMemoryCustomizationRepository();
  const fs = new InMemoryFileSystem();
  const sm = new SymlinkManager(fs, new FixedClock(new Date()), '/workspace');
  const manager = new AdapterManager({
    settingsService,
    customizationRepository: customizationRepo,
    symlinkManager: sm,
    workspacePath: '/workspace',
    adapters: new Map(),
  });
  const listSpy = vi.spyOn(customizationRepo, 'list');
  return { manager, listSpy };
};

describe('AdapterManager.removeAdapterSymlinks — unknown adapter (AC#4)', () => {
  it('returns { removed: 0, skipped: 0, errors: [] } without calling list', async () => {
    const { manager, listSpy } = await setup();

    const result = await manager.removeAdapterSymlinks('unknown');

    expect(result).toEqual({ removed: 0, skipped: 0, errors: [] });
    expect(listSpy).not.toHaveBeenCalled();
  });
});
