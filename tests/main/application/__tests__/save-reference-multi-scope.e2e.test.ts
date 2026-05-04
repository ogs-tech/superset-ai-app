import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { CopilotInstructionsGen } from '../../../../src/main/application/services/copilot-instructions-gen.js';
import { CopilotAdapter } from '../../../../src/main/infrastructure/adapters/copilot-adapter.js';
import { InMemoryArtifactRepository } from '../../../../src/main/infrastructure/artifact/in-memory-artifact-repository.js';
import { InMemoryFileSystem } from '../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';
import { InMemorySettingsRepository } from '../../../../src/main/infrastructure/settings/in-memory-settings-repository.js';
import { FixedClock } from '../../../../src/main/infrastructure/clock/fixed-clock.js';
import { SymlinkManager } from '../../../../src/main/application/services/symlink-manager.js';
import { AdapterManager } from '../../../../src/main/application/services/adapter-manager.js';
import { SettingsService } from '../../../../src/main/application/services/settings-service.js';
import type { Artifact } from '../../../../src/shared/artifact.js';
import type { Settings } from '../../../../src/shared/settings.js';

const HOMEDIR = '/home/alice';
const WORKSPACE = '/workspace';
const GENERATED = join(WORKSPACE, '_generated/copilot-instructions.md');
const SYMLINK_PERSONAL = join(HOMEDIR, '.copilot/instructions/copilot-instructions.md');

const refMultiScope: Artifact = {
  id: 'reference/guide',
  frontmatter: {
    name: 'guide',
    type: 'reference',
    description: 'desc',
    scopes: ['personal', 'project'],
    version: '1.0.0',
    createdAt: '',
    updatedAt: '',
    includeInCopilotInstructions: true,
  },
  body: '# My Guide',
};

const buildSettings = (): Settings => ({
  workspacePath: WORKSPACE,
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
  const artifactRepo = new InMemoryArtifactRepository();
  const fs = new InMemoryFileSystem();
  fs.createFile(join(WORKSPACE, 'references/guide.md'), '# My Guide');

  const gen = new CopilotInstructionsGen({ artifactRepository: artifactRepo, workspaceFs: fs, workspacePath: WORKSPACE });
  const copilotAdapter = new CopilotAdapter({ homedir: HOMEDIR, workspacePath: WORKSPACE, copilotInstructionsGen: gen });
  const clock = new FixedClock(new Date('2026-05-03T00:00:00Z'));
  const symlinkManager = new SymlinkManager(fs, clock, WORKSPACE);
  const adapterManager = new AdapterManager({
    settingsService,
    artifactRepository: artifactRepo,
    symlinkManager,
    adapters: new Map([[copilotAdapter.adapterId, copilotAdapter]]),
  });
  return { artifactRepo, fs, adapterManager };
};

describe('save-reference-multi-scope e2e (AC#11)', () => {
  it('produces 1 generated file + 3 symlinks (personal + 2 project)', async () => {
    const { artifactRepo, fs, adapterManager } = await setup();

    await artifactRepo.save({ artifact: refMultiScope });
    const results = await adapterManager.syncOne({ artifact: refMultiScope });

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
