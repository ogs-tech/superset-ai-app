import { describe, expect, it } from 'vitest';
import { ClaudeAdapter } from '../../../../../src/main/infrastructure/adapters/claude-adapter.js';
import { InMemoryCustomizationRepository } from '../../../../../src/main/infrastructure/customization/in-memory-customization-repository.js';
import { InMemoryFileSystem } from '../../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';
import { InMemorySettingsRepository } from '../../../../../src/main/infrastructure/settings/in-memory-settings-repository.js';
import { FixedClock } from '../../../../../src/main/infrastructure/clock/fixed-clock.js';
import { SymlinkManager } from '../../../../../src/main/application/services/symlink-manager.js';
import { AdapterManager } from '../../../../../src/main/application/services/adapter-manager.js';
import { SettingsService } from '../../../../../src/main/application/services/settings-service.js';
import type { Customization } from '../../../../../src/shared/customization.js';
import type { Settings } from '../../../../../src/shared/settings.js';

const HOMEDIR = '/Users/alice';
const WORKSPACE = '/workspace';

const skillPersonal: Customization = {
  id: 'skill/review',
  frontmatter: {
    name: 'review',
    type: 'skill',
    description: 'desc',
    scopes: ['personal'],
    version: '1.0.0',
    createdAt: '',
    updatedAt: '',
  },
  body: '# review',
};

const buildSettings = (claudeEnabled: boolean): Settings => ({
  adapters: {
    claude: { enabled: claudeEnabled },
  },
  linkedRepos: [],
  ui: { theme: 'system' },
  language: 'off',
});

const setup = async (settings: Settings) => {
  const settingsRepo = new InMemorySettingsRepository();
  await settingsRepo.save(settings);
  const settingsService = new SettingsService(settingsRepo);
  const customizationRepo = new InMemoryCustomizationRepository();
  const fs = new InMemoryFileSystem();
  fs.createFile('/workspace/skills/review/SKILL.md', '# review');
  const symlinkManager = new SymlinkManager(
    fs,
    new FixedClock(new Date('2026-04-26T10:00:00.000Z')),
    WORKSPACE,
  );
  const claudeAdapter = new ClaudeAdapter({ homedir: HOMEDIR });
  const manager = new AdapterManager({
    settingsService,
    customizationRepository: customizationRepo,
    symlinkManager,
    workspacePath: WORKSPACE,
    adapters: new Map([[claudeAdapter.adapterId, claudeAdapter]]),
  });
  await customizationRepo.save({ customization: skillPersonal });
  return { manager, fs };
};

describe('ClaudeAdapter — wiring with AdapterManager', () => {
  it('produces a SyncResult with adapter:"claude", status:"ok" when enabled', async () => {
    const { manager } = await setup(buildSettings(true));

    const results = await manager.syncAll({});

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      adapter: 'claude',
      status: 'ok',
      destination: '/Users/alice/.claude/skills/review',
    });
  });

  it('produces zero SyncResults with adapter:"claude" when disabled', async () => {
    const { manager } = await setup(buildSettings(false));

    const results = await manager.syncAll({});

    const claudeResults = results.filter((r) => r.adapter === 'claude');
    expect(claudeResults).toHaveLength(0);
  });
});
