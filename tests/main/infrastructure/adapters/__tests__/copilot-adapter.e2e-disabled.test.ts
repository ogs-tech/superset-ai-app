import { describe, expect, it, vi } from 'vitest';
import { join } from 'node:path';
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
import type { Customization, CustomizationType } from '../../../../../src/shared/customization.js';
import type { Settings } from '../../../../../src/shared/settings.js';

const HOMEDIR = '/Users/alice';
const WORKSPACE = '/workspace';

const buildCustomization = (type: CustomizationType, name: string): Customization => ({
  id: `${type}/${name}`,
  frontmatter: {
    name,
    type,
    description: 'desc',
    scopes: ['personal'],
    version: '1.0.0',
    createdAt: '',
    updatedAt: '',
  },
  body: `# ${name}`,
});

const customizations: Customization[] = [
  buildCustomization('skill', 'review'),
  buildCustomization('agent', 'triage'),
  buildCustomization('reference', 'glossary'),
  buildCustomization('global-instruction', 'default'),
];

const buildSettings = (): Settings => ({
  workspacePath: WORKSPACE,
  adapters: {
    claude: { enabled: false },
    copilot: { enabled: false, exclusiveSkillsWithClaude: false },
  },
  linkedRepos: [],
  ui: { theme: 'system' },
});

const setup = async () => {
  const settingsRepo = new InMemorySettingsRepository();
  await settingsRepo.save(buildSettings());
  const settingsService = new SettingsService(settingsRepo);
  const customizationRepo = new InMemoryCustomizationRepository();
  const fs = new InMemoryFileSystem();
  fs.createFile(join(WORKSPACE, 'skills/review'), '# review\n');
  fs.createFile(join(WORKSPACE, 'agents/triage.md'), '# triage\n');
  fs.createFile(join(WORKSPACE, 'references/glossary.md'), '# glossary\n');
  fs.createFile(join(WORKSPACE, 'global-instructions/default.md'), '# default\n');
  const clock = new FixedClock(new Date('2026-04-26T10:00:00.000Z'));
  const symlinkManager = new SymlinkManager(fs, clock, WORKSPACE);
  const gen: CopilotInstructionsGenPort = { generate: vi.fn().mockResolvedValue({ path: `${WORKSPACE}/_generated/copilot-instructions.md`, refsIncluded: 0 }) };
  const copilotAdapter = new CopilotAdapter({ homedir: HOMEDIR, workspacePath: WORKSPACE, copilotInstructionsGen: gen });
  const manager = new AdapterManager({
    settingsService,
    customizationRepository: customizationRepo,
    symlinkManager,
    adapters: new Map<string, Adapter>([[copilotAdapter.adapterId, copilotAdapter]]),
  });
  for (const customization of customizations) {
    await customizationRepo.save({ customization });
  }
  return { manager };
};

describe('CopilotAdapter — e2e disabled (AC#11)', () => {
  it('syncAll produces zero copilot SyncResults when copilot is disabled', async () => {
    const { manager } = await setup();

    const results = await manager.syncAll({});
    const copilotResults = results.filter((r) => r.adapter === 'copilot');

    expect(copilotResults).toHaveLength(0);
  });

  it('syncOne produces zero copilot SyncResults for any customization type when copilot is disabled', async () => {
    const { manager } = await setup();

    for (const customization of customizations) {
      const results = await manager.syncOne({ customization });
      const copilotResults = results.filter((r) => r.adapter === 'copilot');
      expect(copilotResults).toHaveLength(0);
    }
  });
});
