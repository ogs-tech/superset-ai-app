import { describe, expect, it, vi } from 'vitest';
import { isAbsolute } from 'node:path';
import type { CopilotInstructionsGenPort } from '../../../../../src/main/application/ports/copilot-instructions-gen.js';
import { ClaudeAdapter } from '../../../../../src/main/infrastructure/adapters/claude-adapter.js';
import { CopilotAdapter } from '../../../../../src/main/infrastructure/adapters/copilot-adapter.js';
import { InMemoryArtifactRepository } from '../../../../../src/main/infrastructure/artifact/in-memory-artifact-repository.js';
import { InMemoryFileSystem } from '../../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';
import { InMemorySettingsRepository } from '../../../../../src/main/infrastructure/settings/in-memory-settings-repository.js';
import { FixedClock } from '../../../../../src/main/infrastructure/clock/fixed-clock.js';
import { SymlinkManager } from '../../../../../src/main/application/services/symlink-manager.js';
import { AdapterManager } from '../../../../../src/main/application/services/adapter-manager.js';
import { ArtifactService } from '../../../../../src/main/application/services/artifact-service.js';
import { SettingsService } from '../../../../../src/main/application/services/settings-service.js';
import type { Adapter } from '../../../../../src/main/application/ports/adapter.js';
import type { Artifact } from '../../../../../src/shared/artifact.js';
import type { Settings } from '../../../../../src/shared/settings.js';

const HOMEDIR = '/Users/alice';
const WORKSPACE = '/workspace';

const globalInstruction = (): Artifact => ({
  id: '',
  frontmatter: {
    name: 'default',
    type: 'global-instruction',
    description: 'global instruction',
    scopes: ['personal'],
    version: '0.1.0',
    createdAt: '',
    updatedAt: '',
  },
  body: `# default\n`,
});

const baseSettings = (
  overrides: Partial<Settings['adapters']> = {},
): Settings => ({
  workspacePath: WORKSPACE,
  adapters: {
    claude: { enabled: true },
    copilot: { enabled: true, exclusiveSkillsWithClaude: false },
    ...overrides,
  },
  linkedRepos: [],
  ui: { theme: 'system' },
});

const setup = async () => {
  const settingsRepo = new InMemorySettingsRepository();
  await settingsRepo.save(baseSettings());
  const settingsService = new SettingsService(settingsRepo);
  const artifactRepo = new InMemoryArtifactRepository();
  const fs = new InMemoryFileSystem();
  const clock = new FixedClock(new Date('2026-04-26T10:00:00.000Z'));
  const symlinkManager = new SymlinkManager(fs, clock, WORKSPACE);
  const claudeAdapter = new ClaudeAdapter({ homedir: HOMEDIR });
  const gen: CopilotInstructionsGenPort = {
    generate: vi.fn().mockResolvedValue({ path: `${WORKSPACE}/_generated/copilot-instructions.md`, refsIncluded: 0 }),
  };
  const copilotAdapter = new CopilotAdapter({ homedir: HOMEDIR, workspacePath: WORKSPACE, copilotInstructionsGen: gen });
  const adapterManager = new AdapterManager({
    settingsService,
    artifactRepository: artifactRepo,
    symlinkManager,
    adapters: new Map<string, Adapter>([
      [claudeAdapter.adapterId, claudeAdapter],
      [copilotAdapter.adapterId, copilotAdapter],
    ]),
  });
  const artifactService = new ArtifactService(artifactRepo, clock, adapterManager);
  return { artifactService, fs };
};

describe('global-instruction — end-to-end save fans out to both adapters', () => {
  it('save creates a Claude symlink at <homedir>/.claude/CLAUDE.md → <workspace>/global-instructions/default.md', async () => {
    const { artifactService, fs } = await setup();

    const result = await artifactService.save({
      artifact: globalInstruction(),
      isCreate: true,
    });

    const claudeOk = result.syncReport.find(
      (r) => r.adapter === 'claude' && r.status === 'ok',
    );
    expect(claudeOk).toBeDefined();

    const destination = '/Users/alice/.claude/CLAUDE.md';
    const stat = await fs.lstat(destination);
    expect(stat.kind).toBe('symlink');
    const target = await fs.readlink(destination);
    expect(target).toBe('/workspace/global-instructions/default.md');
    expect(isAbsolute(destination)).toBe(true);
    expect(isAbsolute(target)).toBe(true);
  });

  it('save creates a Copilot symlink at <homedir>/.copilot/instructions/global.instructions.md → <workspace>/global-instructions/default.md', async () => {
    const { artifactService, fs } = await setup();

    const result = await artifactService.save({
      artifact: globalInstruction(),
      isCreate: true,
    });

    const copilotOk = result.syncReport.find(
      (r) => r.adapter === 'copilot' && r.status === 'ok',
    );
    expect(copilotOk).toBeDefined();

    const destination = '/Users/alice/.copilot/instructions/global.instructions.md';
    const stat = await fs.lstat(destination);
    expect(stat.kind).toBe('symlink');
    const target = await fs.readlink(destination);
    expect(target).toBe('/workspace/global-instructions/default.md');
    expect(isAbsolute(destination)).toBe(true);
    expect(isAbsolute(target)).toBe(true);
  });

  it('save with preexisting file at ~/.claude/CLAUDE.md produces conflict + backup', async () => {
    const { artifactService, fs } = await setup();

    const preexistingPath = '/Users/alice/.claude/CLAUDE.md';
    fs.createFile(preexistingPath, 'prior content');

    const result = await artifactService.save({
      artifact: globalInstruction(),
      isCreate: true,
    });

    const claudeResult = result.syncReport.find((r) => r.adapter === 'claude');
    expect(claudeResult).toBeDefined();
    expect(claudeResult!.status).toBe('conflict');
    expect(claudeResult!.details?.action).toBe('overwritten');

    const backupPath = claudeResult!.details?.backupPath;
    expect(backupPath).toBeDefined();
    expect(backupPath!.startsWith('/workspace/_backups/')).toBe(true);

    const stat = await fs.lstat(preexistingPath);
    expect(stat.kind).toBe('symlink');
    const target = await fs.readlink(preexistingPath);
    expect(target).toBe('/workspace/global-instructions/default.md');

    const backedUp = await fs.lstat(backupPath!);
    expect(backedUp.kind).toBe('file');
  });

  it('all destinations returned for the global-instruction artifact are absolute', async () => {
    const { artifactService } = await setup();

    const result = await artifactService.save({
      artifact: globalInstruction(),
      isCreate: true,
    });

    const allDestinations = result.syncReport
      .map((r) => r.destination)
      .filter((d): d is string => d !== null);

    expect(allDestinations.length).toBeGreaterThan(0);
    for (const d of allDestinations) {
      expect(isAbsolute(d)).toBe(true);
    }
  });
});
