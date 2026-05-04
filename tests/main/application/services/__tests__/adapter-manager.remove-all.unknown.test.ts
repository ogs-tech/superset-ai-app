import { describe, it, expect, vi } from 'vitest';
import { InMemoryArtifactRepository } from '../../../../../src/main/infrastructure/artifact/in-memory-artifact-repository.js';
import { InMemorySettingsRepository } from '../../../../../src/main/infrastructure/settings/in-memory-settings-repository.js';
import { InMemoryFileSystem } from '../../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';
import { FixedClock } from '../../../../../src/main/infrastructure/clock/fixed-clock.js';
import { SymlinkManager } from '../../../../../src/main/application/services/symlink-manager.js';
import { AdapterManager } from '../../../../../src/main/application/services/adapter-manager.js';
import { SettingsService } from '../../../../../src/main/application/services/settings-service.js';
import type { Settings } from '../../../../../src/shared/settings.js';

const baseSettings: Settings = {
  workspacePath: '/workspace',
  adapters: { claude: { enabled: true }, copilot: { enabled: true, exclusiveSkillsWithClaude: false } },
  linkedRepos: [],
  ui: { theme: 'system' },
};

const setup = async () => {
  const repo = new InMemorySettingsRepository();
  await repo.save(baseSettings);
  const settingsService = new SettingsService(repo);
  const artifactRepo = new InMemoryArtifactRepository();
  const fs = new InMemoryFileSystem();
  const sm = new SymlinkManager(fs, new FixedClock(new Date()), baseSettings.workspacePath);
  const manager = new AdapterManager({
    settingsService,
    artifactRepository: artifactRepo,
    symlinkManager: sm,
    adapters: new Map(),
  });
  const listSpy = vi.spyOn(artifactRepo, 'list');
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
