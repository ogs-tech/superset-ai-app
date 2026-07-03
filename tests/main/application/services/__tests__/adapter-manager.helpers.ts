import { InMemoryEntityRepository } from '../../../../../src/main/infrastructure/entity/in-memory-entity-repository.js';
import { InMemorySettingsRepository } from '../../../../../src/main/infrastructure/settings/in-memory-settings-repository.js';
import { FixedClock } from '../../../../../src/main/infrastructure/clock/fixed-clock.js';
import { SymlinkManager } from '../../../../../src/main/application/services/symlink-manager.js';
import { AdapterManager } from '../../../../../src/main/application/services/adapter-manager.js';
import { SettingsService } from '../../../../../src/main/application/services/settings-service.js';
import type { Entity } from '../../../../../src/shared/entity.js';
import type { Settings } from '../../../../../src/shared/settings.js';
import type { Adapter } from '../../../../../src/main/application/ports/adapter.js';
import { InMemoryFileSystem } from '../../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';

export const DEFAULT_WORKSPACE_PATH = '/workspace';

export const defaultSettings: Settings = {
  adapters: {
    claude: { enabled: true },
    cursor: { enabled: false },
  },
  linkedRepos: [],
  ui: { theme: 'system' },
  language: 'off',
};

export const setupAdapterManager = async (
  adapters: Adapter[],
  settings: Settings = defaultSettings,
  workspacePath: string = DEFAULT_WORKSPACE_PATH,
) => {
  const settingsRepo = new InMemorySettingsRepository();
  await settingsRepo.save(settings);
  const settingsService = new SettingsService(settingsRepo);
  const entityRepository = new InMemoryEntityRepository();
  const registerEntity = async (entity: Entity) => {
    await entityRepository.save(entity);
  };
  const fs = new InMemoryFileSystem();
  const symlinkManager = new SymlinkManager(fs, new FixedClock(new Date('2026-04-26T10:00:00.000Z')), workspacePath);
  const manager = new AdapterManager({
    settingsService,
    entityRepository,
    symlinkManager,
    workspacePath,
    adapters: new Map(adapters.map((adapter) => [adapter.adapterId, adapter])),
  });
  return {
    settingsService,
    entityRepository,
    symlinkManager,
    manager,
    fs,
    registerEntity,
    workspacePath,
  };
};
