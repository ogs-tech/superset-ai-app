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

const refMultiScope: Customization = {
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
  body: '# My Guide',
};

const buildSettings = (): Settings => ({
  adapters: { claude: { enabled: false }, copilot: { enabled: true, exclusiveSkillsWithClaude: false } },
  linkedRepos: [
    { id: 'r1', name: 'repo1', path: '/repos/repo1' },
    { id: 'r2', name: 'repo2', path: '/repos/repo2' },
  ],
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
    workspacePath: WORKSPACE,
    adapters: new Map([[copilotAdapter.adapterId, copilotAdapter]]),
  });
  return { customizationRepo, fs, adapterManager };
};

describe('save-reference-multi-scope e2e (AC#11)', () => {
  it('produces 1 generated file + 3 symlinks (personal + 2 project)', async () => {
    const { customizationRepo, fs, adapterManager } = await setup();

    await customizationRepo.save({ customization: refMultiScope });
    const results = await adapterManager.syncOne({ customization: refMultiScope });

    const okResults = results.filter((r) => r.status === 'ok');
    expect(okResults).toHaveLength(3);

    const personalEntry = await fs.lstat(SYMLINK_PERSONAL);
    expect(personalEntry.kind).toBe('symlink');

    const proj1Entry = await fs.lstat(join('/repos/repo1', '.github/copilot-instructions.md'));
    expect(proj1Entry.kind).toBe('symlink');

    const proj2Entry = await fs.lstat(join('/repos/repo2', '.github/copilot-instructions.md'));
    expect(proj2Entry.kind).toBe('symlink');

    const genEntry = await fs.stat(GENERATED);
    expect(genEntry).not.toBeNull();
  });
});
