import { describe, it, expect, vi } from 'vitest';
import { join } from 'node:path';
import { InMemoryCustomizationRepository } from '../../../../src/main/infrastructure/customization/in-memory-customization-repository.js';
import { InMemorySettingsRepository } from '../../../../src/main/infrastructure/settings/in-memory-settings-repository.js';
import { InMemoryFileSystem } from '../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';
import { FixedClock } from '../../../../src/main/infrastructure/clock/fixed-clock.js';
import { SymlinkManager } from '../../../../src/main/application/services/symlink-manager.js';
import { AdapterManager } from '../../../../src/main/application/services/adapter-manager.js';
import { SettingsService } from '../../../../src/main/application/services/settings-service.js';
import { CopilotAdapter } from '../../../../src/main/infrastructure/adapters/copilot-adapter.js';
import type { CopilotInstructionsGenPort } from '../../../../src/main/application/ports/copilot-instructions-gen.js';
import type { Customization } from '../../../../src/shared/customization.js';
import type { Settings } from '../../../../src/shared/settings.js';

const HOMEDIR = '/home/alice';
const WORKSPACE = '/workspace';
const GENERATED = join(WORKSPACE, '_generated/copilot-instructions.md');

const baseSettings: Settings = {
  workspacePath: WORKSPACE,
  adapters: { claude: { enabled: false }, copilot: { enabled: true, exclusiveSkillsWithClaude: false } },
  linkedRepos: [
    { id: 'r1', name: 'r1', path: '/repos/r1' },
    { id: 'r2', name: 'r2', path: '/repos/r2' },
  ],
  ui: { theme: 'system' },
};

const refFlagged: Customization = {
  id: 'reference/guide',
  frontmatter: {
    name: 'guide',
    type: 'reference',
    description: 'desc',
    scopes: ['personal', 'project'],
    version: '1.0.0',
    createdAt: '',
    updatedAt: '',
  },
  body: '# guide',
};

describe('disable-copilot-aggregate e2e (AC#11)', () => {
  it('removes aggregate symlinks and _generated file', async () => {
    const settingsRepo = new InMemorySettingsRepository();
    await settingsRepo.save(baseSettings);
    const settingsService = new SettingsService(settingsRepo);
    const customizationRepo = new InMemoryCustomizationRepository();
    await customizationRepo.save({ customization: refFlagged });

    const fs = new InMemoryFileSystem();
    fs.createFile(GENERATED, '<!-- GENERATED -->');

    const symlinkPersonal = join(HOMEDIR, '.copilot/instructions/copilot-instructions.md');
    const symlinkProject1 = '/repos/r1/.github/copilot-instructions.md';
    const symlinkProject2 = '/repos/r2/.github/copilot-instructions.md';
    await fs.symlink({ target: GENERATED, path: symlinkPersonal });
    await fs.symlink({ target: GENERATED, path: symlinkProject1 });
    await fs.symlink({ target: GENERATED, path: symlinkProject2 });

    const gen: CopilotInstructionsGenPort = {
      generate: vi.fn().mockResolvedValue({ path: GENERATED, refsIncluded: 1 }),
    };
    const sm = new SymlinkManager(fs, new FixedClock(new Date()), WORKSPACE);
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

    const result = await manager.removeAdapterSymlinks('copilot');

    expect(result.removed).toBe(3);
    expect(result.errors).toHaveLength(0);

    const genEntry = await fs.lstat(GENERATED);
    expect(genEntry.kind).toBe('none');
  });
});
