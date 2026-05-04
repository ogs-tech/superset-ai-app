import { describe, expect, it, vi } from 'vitest';
import { join } from 'node:path';
import { CopilotAdapter } from '../../../../../src/main/infrastructure/adapters/copilot-adapter.js';
import { ClaudeAdapter } from '../../../../../src/main/infrastructure/adapters/claude-adapter.js';
import { InMemoryArtifactRepository } from '../../../../../src/main/infrastructure/artifact/in-memory-artifact-repository.js';
import { InMemoryFileSystem } from '../../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';
import { InMemorySettingsRepository } from '../../../../../src/main/infrastructure/settings/in-memory-settings-repository.js';
import { FixedClock } from '../../../../../src/main/infrastructure/clock/fixed-clock.js';
import { SymlinkManager } from '../../../../../src/main/application/services/symlink-manager.js';
import { AdapterManager } from '../../../../../src/main/application/services/adapter-manager.js';
import { SettingsService } from '../../../../../src/main/application/services/settings-service.js';
import type { CopilotInstructionsGenPort } from '../../../../../src/main/application/ports/copilot-instructions-gen.js';
import type { Artifact } from '../../../../../src/shared/artifact.js';
import type { Settings } from '../../../../../src/shared/settings.js';

const HOMEDIR = '/Users/alice';
const WORKSPACE = '/workspace';
const COPILOT_SKILL_PATH = join(HOMEDIR, '.copilot/skills/my-skill');
const CLAUDE_SKILL_PATH = join(HOMEDIR, '.claude/skills/my-skill');

const skillPersonal: Artifact = {
  id: 'skill/my-skill',
  frontmatter: {
    name: 'my-skill',
    type: 'skill',
    description: 'desc',
    scopes: ['personal'],
    version: '1.0.0',
    createdAt: '',
    updatedAt: '',
  },
  body: '# my-skill',
};

const makeSettings = (exclusiveSkillsWithClaude: boolean, claudeEnabled: boolean): Settings => ({
  workspacePath: WORKSPACE,
  adapters: {
    claude: { enabled: claudeEnabled },
    copilot: { enabled: true, exclusiveSkillsWithClaude },
  },
  linkedRepos: [],
  ui: { theme: 'system' },
});

const setup = async (settings: Settings) => {
  const settingsRepo = new InMemorySettingsRepository();
  await settingsRepo.save(settings);
  const settingsService = new SettingsService(settingsRepo);
  const artifactRepo = new InMemoryArtifactRepository();
  const fs = new InMemoryFileSystem();
  fs.createFile(join(WORKSPACE, 'skills/my-skill'), '# my-skill\n');
  const clock = new FixedClock(new Date('2026-04-26T10:00:00.000Z'));
  const symlinkManager = new SymlinkManager(fs, clock, WORKSPACE);
  const gen: CopilotInstructionsGenPort = {
    generate: vi.fn().mockResolvedValue({ path: `${WORKSPACE}/_generated/copilot-instructions.md`, refsIncluded: 0 }),
  };
  const copilotAdapter = new CopilotAdapter({
    homedir: HOMEDIR,
    workspacePath: WORKSPACE,
    copilotInstructionsGen: gen,
    settingsService,
  });
  const claudeAdapter = new ClaudeAdapter({ homedir: HOMEDIR });
  const manager = new AdapterManager({
    settingsService,
    artifactRepository: artifactRepo,
    symlinkManager,
    adapters: new Map<string, import('../../../../../src/main/application/ports/adapter.js').Adapter>([
      [copilotAdapter.adapterId, copilotAdapter],
      [claudeAdapter.adapterId, claudeAdapter],
    ]),
  });
  await artifactRepo.save({ artifact: skillPersonal });
  return { manager, fs, settingsService, settingsRepo };
};

describe('CopilotAdapter — exclusive skills e2e (AC#6)', () => {
  it('flag=false: copilot skill symlink created alongside claude skill symlink', async () => {
    const { manager, fs } = await setup(makeSettings(false, true));

    await manager.syncAll({});

    expect(await fs.pathExists(COPILOT_SKILL_PATH)).toBe(true);
    expect(await fs.pathExists(CLAUDE_SKILL_PATH)).toBe(true);
  });

  it('flag=true + claude on: copilot skill symlink NOT created; claude skill symlink created', async () => {
    const { manager, fs } = await setup(makeSettings(true, true));

    await manager.syncAll({});

    expect(await fs.pathExists(COPILOT_SKILL_PATH)).toBe(false);
    expect(await fs.pathExists(CLAUDE_SKILL_PATH)).toBe(true);
  });

  it('flag toggle ON: removeAll (before flag save) removes copilot skill symlink', async () => {
    const { manager, fs, settingsRepo } = await setup(makeSettings(false, true));

    await manager.syncAll({});
    expect(await fs.pathExists(COPILOT_SKILL_PATH)).toBe(true);

    // Order: removeAll first (flag still false → resolveDestinations returns destinations), then save flag
    await manager.removeAll({ adapterId: 'copilot' });
    await settingsRepo.save(makeSettings(true, true));

    expect(await fs.pathExists(COPILOT_SKILL_PATH)).toBe(false);
    expect(await fs.pathExists(CLAUDE_SKILL_PATH)).toBe(true);
  });

  it('flag toggle OFF: syncAll recreates copilot skill symlink', async () => {
    const { manager, fs, settingsRepo } = await setup(makeSettings(true, true));

    await manager.syncAll({});
    expect(await fs.pathExists(COPILOT_SKILL_PATH)).toBe(false);

    await settingsRepo.save(makeSettings(false, true));
    await manager.syncAll({ adapterId: 'copilot' });

    expect(await fs.pathExists(COPILOT_SKILL_PATH)).toBe(true);
  });
});
