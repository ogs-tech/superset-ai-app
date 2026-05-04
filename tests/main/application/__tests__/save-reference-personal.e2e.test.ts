import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { CopilotInstructionsGen } from '../../../../src/main/application/services/copilot-instructions-gen.js';
import { CopilotAdapter } from '../../../../src/main/infrastructure/adapters/copilot-adapter.js';
import { InMemoryCustomizationRepository } from '../../../../src/main/infrastructure/customization/in-memory-customization-repository.js';
import { InMemoryFileSystem } from '../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';
import { InMemorySettingsRepository } from '../../../../src/main/infrastructure/settings/in-memory-settings-repository.js';
import { FixedClock } from '../../../../src/main/infrastructure/clock/fixed-clock.js';
import { SymlinkManager } from '../../../../src/main/application/services/symlink-manager.js';
import { AdapterManager } from '../../../../src/main/application/services/adapter-manager.js';
import { SettingsService } from '../../../../src/main/application/services/settings-service.js';
import type { Customization } from '../../../../src/shared/customization.js';
import type { Settings } from '../../../../src/shared/settings.js';

const HOMEDIR = '/home/alice';
const WORKSPACE = '/workspace';
const GENERATED = join(WORKSPACE, '_generated/copilot-instructions.md');
const SYMLINK_PERSONAL = join(HOMEDIR, '.copilot/instructions/copilot-instructions.md');

const refPersonal: Customization = {
  id: 'reference/guide',
  frontmatter: {
    name: 'guide',
    type: 'reference',
    description: 'desc',
    scopes: ['personal'],
    version: '1.0.0',
    createdAt: '',
    updatedAt: '',
  },
  body: '# My Guide',
};

const buildSettings = (): Settings => ({
  workspacePath: WORKSPACE,
  adapters: { claude: { enabled: false }, copilot: { enabled: true, exclusiveSkillsWithClaude: false } },
  linkedRepos: [],
  ui: { theme: 'system' },
});

const setup = async () => {
  const settingsRepo = new InMemorySettingsRepository();
  await settingsRepo.save(buildSettings());
  const settingsService = new SettingsService(settingsRepo);
  const customizationRepo = new InMemoryCustomizationRepository();
  const fs = new InMemoryFileSystem();
  fs.createFile(join(WORKSPACE, 'references/guide.md'), '# My Guide');

  const gen = new CopilotInstructionsGen({ customizationRepository: customizationRepo, workspaceFs: fs, workspacePath: WORKSPACE });
  const copilotAdapter = new CopilotAdapter({ homedir: HOMEDIR, workspacePath: WORKSPACE, copilotInstructionsGen: gen });
  const clock = new FixedClock(new Date('2026-05-03T00:00:00Z'));
  const symlinkManager = new SymlinkManager(fs, clock, WORKSPACE);
  const adapterManager = new AdapterManager({
    settingsService,
    customizationRepository: customizationRepo,
    symlinkManager,
    adapters: new Map([[copilotAdapter.adapterId, copilotAdapter]]),
  });
  return { customizationRepo, fs, adapterManager };
};

describe('save-reference-personal e2e (AC#10)', () => {
  it('generates _generated/copilot-instructions.md and creates personal symlink', async () => {
    const { customizationRepo, fs, adapterManager } = await setup();

    await customizationRepo.save({ customization: refPersonal });
    await adapterManager.syncOne({ customization: refPersonal });

    const content = await fs.readFile(GENERATED);
    expect(content).toMatch(/^<!-- GENERATED — edit references in the app -->/);
    expect(content).toContain('# My Guide');

    const stat = await fs.stat(GENERATED);
    expect(stat!.mode & 0o777).toBe(0o444);

    const entry = await fs.lstat(SYMLINK_PERSONAL);
    expect(entry.kind).toBe('symlink');
  });
});
