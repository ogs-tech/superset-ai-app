import { describe, expect, it, vi } from 'vitest';
import { join } from 'node:path';
import { ClaudeAdapter } from '../../../../../src/main/infrastructure/adapters/claude-adapter.js';
import { CopilotAdapter } from '../../../../../src/main/infrastructure/adapters/copilot-adapter.js';
import { InMemoryCustomizationRepository } from '../../../../../src/main/infrastructure/customization/in-memory-customization-repository.js';
import { InMemoryFileSystem } from '../../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';
import { InMemorySettingsRepository } from '../../../../../src/main/infrastructure/settings/in-memory-settings-repository.js';
import { FixedClock } from '../../../../../src/main/infrastructure/clock/fixed-clock.js';
import { SymlinkManager } from '../../../../../src/main/application/services/symlink-manager.js';
import { AdapterManager } from '../../../../../src/main/application/services/adapter-manager.js';
import { SettingsService } from '../../../../../src/main/application/services/settings-service.js';
import type { Adapter } from '../../../../../src/main/application/ports/adapter.js';
import type { CopilotInstructionsGenPort } from '../../../../../src/main/application/ports/copilot-instructions-gen.js';
import type { Customization } from '../../../../../src/shared/customization.js';
import type { LinkedRepo, Settings } from '../../../../../src/shared/settings.js';

const HOMEDIR = '/Users/alice';
const WORKSPACE = '/workspace';

const skillBoth: Customization = {
  id: 'skill/review',
  frontmatter: {
    name: 'review',
    type: 'skill',
    description: 'desc',
    scopes: ['personal', 'project'],
    version: '1.0.0',
    createdAt: '',
    updatedAt: '',
  },
  body: '# review',
};

const repos: LinkedRepo[] = [{ id: 'r1', name: 'r1', path: '/repos/r1' }];

const buildSettings = (): Settings => ({
  adapters: {
    claude: { enabled: true },
    copilot: { enabled: true, exclusiveSkillsWithClaude: false },
  },
  linkedRepos: repos,
  ui: { theme: 'system' },
  language: 'off',
});

const setup = async () => {
  const settingsRepo = new InMemorySettingsRepository();
  await settingsRepo.save(buildSettings());
  const settingsService = new SettingsService(settingsRepo);
  const customizationRepo = new InMemoryCustomizationRepository();
  const fs = new InMemoryFileSystem();
  fs.createFile(join(WORKSPACE, 'skills/review'), '# review\n');
  const clock = new FixedClock(new Date('2026-04-26T10:00:00.000Z'));
  const symlinkManager = new SymlinkManager(fs, clock, WORKSPACE);
  const claudeAdapter = new ClaudeAdapter({ homedir: HOMEDIR });
  const gen: CopilotInstructionsGenPort = { generate: vi.fn().mockResolvedValue({ path: `${WORKSPACE}/_generated/copilot-instructions.md`, refsIncluded: 0 }) };
  const copilotAdapter = new CopilotAdapter({ homedir: HOMEDIR, workspacePath: WORKSPACE, copilotInstructionsGen: gen });
  const manager = new AdapterManager({
    settingsService,
    customizationRepository: customizationRepo,
    symlinkManager,
    workspacePath: WORKSPACE,
    adapters: new Map<string, Adapter>([
      [claudeAdapter.adapterId, claudeAdapter],
      [copilotAdapter.adapterId, copilotAdapter],
    ]),
  });
  await customizationRepo.save({ customization: skillBoth });
  return { manager };
};

describe('CopilotAdapter — e2e multi-adapter (AC#14)', () => {
  it('syncOne with both adapters enabled produces 2 claude + 2 copilot SyncResults (personal + project each)', async () => {
    const { manager } = await setup();

    const results = await manager.syncOne({ customization: skillBoth });

    const claudePersonal = results.find(
      (r) =>
        r.adapter === 'claude' &&
        r.status === 'ok' &&
        r.destination === join(HOMEDIR, '.claude/skills', 'review'),
    );
    const claudeProject = results.find(
      (r) =>
        r.adapter === 'claude' &&
        r.status === 'ok' &&
        r.destination === join('/repos/r1', '.claude/skills', 'review'),
    );
    const copilotPersonal = results.find(
      (r) =>
        r.adapter === 'copilot' &&
        r.status === 'ok' &&
        r.destination === join(HOMEDIR, '.copilot/skills', 'review'),
    );
    const copilotProject = results.find(
      (r) =>
        r.adapter === 'copilot' &&
        r.status === 'ok' &&
        r.destination === join('/repos/r1', '.github/skills', 'review'),
    );

    expect(claudePersonal).toBeDefined();
    expect(claudeProject).toBeDefined();
    expect(copilotPersonal).toBeDefined();
    expect(copilotProject).toBeDefined();

    const okResults = results.filter((r) => r.status === 'ok');
    expect(okResults).toHaveLength(4);
  });
});
