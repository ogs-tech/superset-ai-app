import { describe, expect, it, vi } from 'vitest';
import { CopilotAdapter } from '../../../../../src/main/infrastructure/adapters/copilot-adapter.js';
import { InMemoryCustomizationRepository } from '../../../../../src/main/infrastructure/customization/in-memory-customization-repository.js';
import { InMemoryFileSystem } from '../../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';
import { InMemorySettingsRepository } from '../../../../../src/main/infrastructure/settings/in-memory-settings-repository.js';
import { FixedClock } from '../../../../../src/main/infrastructure/clock/fixed-clock.js';
import { SymlinkManager } from '../../../../../src/main/application/services/symlink-manager.js';
import { AdapterManager } from '../../../../../src/main/application/services/adapter-manager.js';
import { SettingsService } from '../../../../../src/main/application/services/settings-service.js';
import type { Customization } from '../../../../../src/shared/customization.js';
import type { Settings } from '../../../../../src/shared/settings.js';
import type { CopilotInstructionsGenPort } from '../../../../../src/main/application/ports/copilot-instructions-gen.js';

const HOMEDIR = '/Users/alice';
const WORKSPACE = '/workspace';

const globalInstructionDefault: Customization = {
  id: 'global-instruction/default',
  frontmatter: {
    name: 'default',
    type: 'global-instruction',
    description: 'global instruction',
    scopes: ['personal'],
    version: '0.1.0',
    createdAt: '',
    updatedAt: '',
  },
  body: '# default\n',
};

const buildSettings = (copilotEnabled: boolean): Settings => ({
  workspacePath: WORKSPACE,
  adapters: {
    claude: { enabled: false },
    copilot: { enabled: copilotEnabled, exclusiveSkillsWithClaude: false },
  },
  linkedRepos: [],
  ui: { theme: 'system' },
});

const makeGen = (): CopilotInstructionsGenPort => ({
  generate: vi.fn().mockResolvedValue({ path: `${WORKSPACE}/_generated/copilot-instructions.md`, refsIncluded: 0 }),
});

const setup = async (settings: Settings) => {
  const settingsRepo = new InMemorySettingsRepository();
  await settingsRepo.save(settings);
  const settingsService = new SettingsService(settingsRepo);
  const customizationRepo = new InMemoryCustomizationRepository();
  const fs = new InMemoryFileSystem();
  fs.createFile('/workspace/global-instructions/default.md', '# default\n');
  const symlinkManager = new SymlinkManager(
    fs,
    new FixedClock(new Date('2026-04-26T10:00:00.000Z')),
    settings.workspacePath,
  );
  const copilotAdapter = new CopilotAdapter({
    homedir: HOMEDIR,
    workspacePath: WORKSPACE,
    copilotInstructionsGen: makeGen(),
  });
  const manager = new AdapterManager({
    settingsService,
    customizationRepository: customizationRepo,
    symlinkManager,
    adapters: new Map([[copilotAdapter.adapterId, copilotAdapter]]),
  });
  await customizationRepo.save({ customization: globalInstructionDefault });
  return { manager, fs };
};

describe('CopilotAdapter — wiring with AdapterManager', () => {
  it('produces SyncResult adapter:"copilot" status:"ok" when enabled and global-instruction:default exists', async () => {
    const { manager } = await setup(buildSettings(true));

    const results = await manager.syncAll({});

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      adapter: 'copilot',
      status: 'ok',
      destination: '/Users/alice/.copilot/instructions/global.instructions.md',
    });
  });

  it('produces zero SyncResults when disabled', async () => {
    const { manager } = await setup(buildSettings(false));

    const results = await manager.syncAll({});

    const copilotResults = results.filter((r) => r.adapter === 'copilot');
    expect(copilotResults).toHaveLength(0);
  });
});
