import { describe, expect, it } from 'vitest';
import { ClaudeAdapter } from '../../../../../src/main/infrastructure/adapters/claude-adapter.js';
import { InMemoryCustomizationRepository } from '../../../../../src/main/infrastructure/customization/in-memory-customization-repository.js';
import { InMemoryFileSystem } from '../../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';
import { InMemorySettingsRepository } from '../../../../../src/main/infrastructure/settings/in-memory-settings-repository.js';
import { FixedClock } from '../../../../../src/main/infrastructure/clock/fixed-clock.js';
import { SymlinkManager } from '../../../../../src/main/application/services/symlink-manager.js';
import { AdapterManager } from '../../../../../src/main/application/services/adapter-manager.js';
import { CustomizationService } from '../../../../../src/main/application/services/customization-service.js';
import { SettingsService } from '../../../../../src/main/application/services/settings-service.js';
import type { Customization } from '../../../../../src/shared/customization.js';
import type { LinkedRepo, Settings } from '../../../../../src/shared/settings.js';

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

const agentProject: Customization = {
  id: 'agent/triage',
  frontmatter: {
    name: 'triage',
    type: 'agent',
    description: 'desc',
    scopes: ['project'],
    version: '1.0.0',
    createdAt: '',
    updatedAt: '',
  },
  body: '# triage',
};

const buildSettings = (linkedRepos: LinkedRepo[] = []): Settings => ({
  workspacePath: WORKSPACE,
  adapters: {
    claude: { enabled: true },
    copilot: { enabled: false, exclusiveSkillsWithClaude: false },
  },
  linkedRepos,
  ui: { theme: 'system' },
});

const setup = async (settings: Settings) => {
  const settingsRepo = new InMemorySettingsRepository();
  await settingsRepo.save(settings);
  const settingsService = new SettingsService(settingsRepo);
  const customizationRepo = new InMemoryCustomizationRepository();
  const fs = new InMemoryFileSystem();
  const clock = new FixedClock(new Date('2026-04-26T10:00:00.000Z'));
  const symlinkManager = new SymlinkManager(fs, clock, settings.workspacePath);
  const claudeAdapter = new ClaudeAdapter({ homedir: HOMEDIR });
  const adapterManager = new AdapterManager({
    settingsService,
    customizationRepository: customizationRepo,
    symlinkManager,
    adapters: new Map([[claudeAdapter.adapterId, claudeAdapter]]),
  });
  const customizationService = new CustomizationService(customizationRepo, clock, adapterManager);
  return { customizationService, fs, settingsService };
};

describe('ClaudeAdapter — end-to-end via CustomizationService', () => {
  it('save(skill, scope=personal) creates symlink at <homedir>/.claude/skills/<slug> resolving to <workspace>/skills/<slug>', async () => {
    const { customizationService, fs } = await setup(buildSettings());

    const result = await customizationService.save({ customization: skillPersonal, isCreate: true });

    expect(result.syncReport).toHaveLength(1);
    expect(result.syncReport[0]).toMatchObject({ adapter: 'claude', status: 'ok' });

    const destination = '/Users/alice/.claude/skills/review';
    const stat = await fs.lstat(destination);
    expect(stat.kind).toBe('symlink');
    const target = await fs.readlink(destination);
    expect(target).toBe('/workspace/skills/review');
  });

  it('save(agent, scope=project) with 2 linkedRepos creates 2 symlinks resolving to <workspace>/agents/<slug>.md', async () => {
    const repos: LinkedRepo[] = [
      { id: 'r1', name: 'r1', path: '/repos/r1' },
      { id: 'r2', name: 'r2', path: '/repos/r2' },
    ];
    const { customizationService, fs } = await setup(buildSettings(repos));

    const result = await customizationService.save({ customization: agentProject, isCreate: true });

    const okResults = result.syncReport.filter((r) => r.adapter === 'claude' && r.status === 'ok');
    expect(okResults).toHaveLength(2);

    const expectedTarget = '/workspace/agents/triage.md';
    for (const repoPath of ['/repos/r1', '/repos/r2']) {
      const dest = `${repoPath}/.claude/agents/triage.md`;
      const stat = await fs.lstat(dest);
      expect(stat.kind).toBe('symlink');
      const target = await fs.readlink(dest);
      expect(target).toBe(expectedTarget);
    }
  });

  it('re-save without changes is idempotent: no new backups, symlink target unchanged', async () => {
    const { customizationService, fs } = await setup(buildSettings());
    await customizationService.save({ customization: skillPersonal, isCreate: true });

    const destination = '/Users/alice/.claude/skills/review';
    const targetBefore = await fs.readlink(destination);
    const backupsBefore = await fs.pathExists('/workspace/_backups');

    const result = await customizationService.save({ customization: skillPersonal });

    expect(result.syncReport).toHaveLength(1);
    expect(result.syncReport[0]).toMatchObject({ adapter: 'claude', status: 'ok' });
    expect(result.syncReport[0]?.details).toBeUndefined();

    const targetAfter = await fs.readlink(destination);
    expect(targetAfter).toBe(targetBefore);

    const backupsAfter = await fs.pathExists('/workspace/_backups');
    expect(backupsAfter).toBe(backupsBefore);
  });
});
