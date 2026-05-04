import { InMemoryArtifactRepository } from '../../../../../src/main/infrastructure/artifact/in-memory-artifact-repository.js';
import { InMemorySettingsRepository } from '../../../../../src/main/infrastructure/settings/in-memory-settings-repository.js';
import { FixedClock } from '../../../../../src/main/infrastructure/clock/fixed-clock.js';
import { SymlinkManager } from '../../../../../src/main/application/services/symlink-manager.js';
import { AdapterManager } from '../../../../../src/main/application/services/adapter-manager.js';
import { SettingsService } from '../../../../../src/main/application/services/settings-service.js';
import type { Artifact } from '../../../../../src/shared/artifact.js';
import type { Settings } from '../../../../../src/shared/settings.js';
import type { Adapter } from '../../../../../src/main/application/ports/adapter.js';
import { InMemoryFileSystem } from '../../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';

export const defaultSettings: Settings = {
  workspacePath: '/workspace',
  adapters: {
    claude: { enabled: true },
    copilot: { enabled: true, exclusiveSkillsWithClaude: false },
  },
  linkedRepos: [],
  ui: { theme: 'system' },
};

export const setupAdapterManager = async (
  adapters: Adapter[],
  settings: Settings = defaultSettings,
) => {
  const settingsRepo = new InMemorySettingsRepository();
  await settingsRepo.save(settings);
  const settingsService = new SettingsService(settingsRepo);
  const artifactRepo = new InMemoryArtifactRepository();
  const registerArtifact = async (artifact: Artifact) => {
    await artifactRepo.save({ artifact });
  };
  const fs = new InMemoryFileSystem();
  const symlinkManager = new SymlinkManager(fs, new FixedClock(new Date('2026-04-26T10:00:00.000Z')), settings.workspacePath);
  const manager = new AdapterManager({
    settingsService,
    artifactRepository: artifactRepo,
    symlinkManager,
    adapters: new Map(adapters.map((adapter) => [adapter.adapterId, adapter])),
  });
  return { settingsService, artifactRepo, symlinkManager, manager, fs, registerArtifact };
};
