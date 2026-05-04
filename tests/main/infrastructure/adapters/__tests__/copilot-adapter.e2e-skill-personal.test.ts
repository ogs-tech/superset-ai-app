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
import type { Customization } from '../../../../../src/shared/customization.js';
import type { Settings } from '../../../../../src/shared/settings.js';

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

const buildSettings = (): Settings => ({
  workspacePath: WORKSPACE,
  adapters: {
    claude: { enabled: false },
    copilot: { enabled: true, exclusiveSkillsWithClaude: false },
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
  await customizationRepo.save({ customization: skillPersonal });
  return { manager, fs };
};

describe('CopilotAdapter — e2e skill personal (AC#10, AC#12)', () => {
  it('syncOne creates symlink at <homedir>/.copilot/skills/<slug> resolving to <workspace>/skills/<slug>', async () => {
    const { manager, fs } = await setup();

    const results = await manager.syncOne({ customization: skillPersonal });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      adapter: 'copilot',
      status: 'ok',
      destination: join(HOMEDIR, '.copilot/skills', 'review'),
    });

    const target = await fs.readlink(join(HOMEDIR, '.copilot/skills', 'review'));
    expect(target).toBe(join(WORKSPACE, 'skills', 'review'));
  });
});
