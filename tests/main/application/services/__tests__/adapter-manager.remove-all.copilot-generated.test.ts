import { describe, it, expect, vi } from 'vitest';
import { join } from 'node:path';
import { InMemoryCustomizationRepository } from '../../../../../src/main/infrastructure/customization/in-memory-customization-repository.js';
import { InMemorySettingsRepository } from '../../../../../src/main/infrastructure/settings/in-memory-settings-repository.js';
import { InMemoryFileSystem } from '../../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';
import { FixedClock } from '../../../../../src/main/infrastructure/clock/fixed-clock.js';
import { SymlinkManager } from '../../../../../src/main/application/services/symlink-manager.js';
import { AdapterManager } from '../../../../../src/main/application/services/adapter-manager.js';
import { SettingsService } from '../../../../../src/main/application/services/settings-service.js';
import { CopilotAdapter } from '../../../../../src/main/infrastructure/adapters/copilot-adapter.js';
import type { CopilotInstructionsGenPort } from '../../../../../src/main/application/ports/copilot-instructions-gen.js';
import type { Settings } from '../../../../../src/shared/settings.js';

const HOMEDIR = '/home/alice';
const WORKSPACE = '/workspace';
const GENERATED = join(WORKSPACE, '_generated/copilot-instructions.md');

const baseSettings: Settings = {
  workspacePath: WORKSPACE,
  adapters: { claude: { enabled: true }, copilot: { enabled: true, exclusiveSkillsWithClaude: false } },
  linkedRepos: [],
  ui: { theme: 'system' },
};

describe('AdapterManager.removeAdapterSymlinks — Copilot _generated cleanup (AC#18)', () => {
  it('removes _generated/copilot-instructions.md when disabling copilot', async () => {
    const settingsRepo = new InMemorySettingsRepository();
    await settingsRepo.save(baseSettings);
    const settingsService = new SettingsService(settingsRepo);
    const customizationRepo = new InMemoryCustomizationRepository();
    const fs = new InMemoryFileSystem();

    fs.createFile(GENERATED, '<!-- GENERATED -->');
    await fs.chmod(GENERATED, 0o444);

    const sm = new SymlinkManager(fs, new FixedClock(new Date()), WORKSPACE);
    const gen: CopilotInstructionsGenPort = {
      generate: vi.fn().mockResolvedValue({ path: GENERATED, refsIncluded: 0 }),
    };
    const copilotAdapter = new CopilotAdapter({
      homedir: HOMEDIR,
      workspacePath: WORKSPACE,
      copilotInstructionsGen: gen,
    });
    const manager = new AdapterManager({
      settingsService,
      customizationRepository: customizationRepo,
      symlinkManager: sm,
      adapters: new Map([['copilot', copilotAdapter]]),
      workspaceFs: fs,
    });

    await manager.removeAdapterSymlinks('copilot');

    const entry = await fs.lstat(GENERATED);
    expect(entry.kind).toBe('none');
  });
});
