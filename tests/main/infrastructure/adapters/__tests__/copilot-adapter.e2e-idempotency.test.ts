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
const DESTINATION = join(HOMEDIR, '.copilot/skills', 'review');
const BACKUPS_ROOT = join(WORKSPACE, '_backups');

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
  adapters: {
    claude: { enabled: false },
    copilot: { enabled: true, exclusiveSkillsWithClaude: false },
  },
  linkedRepos: [],
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
  const gen: CopilotInstructionsGenPort = { generate: vi.fn().mockResolvedValue({ path: `${WORKSPACE}/_generated/copilot-instructions.md`, refsIncluded: 0 }) };
  const copilotAdapter = new CopilotAdapter({ homedir: HOMEDIR, workspacePath: WORKSPACE, copilotInstructionsGen: gen });
  const manager = new AdapterManager({
    settingsService,
    customizationRepository: customizationRepo,
    symlinkManager,
    workspacePath: WORKSPACE,
    adapters: new Map<string, Adapter>([[copilotAdapter.adapterId, copilotAdapter]]),
  });
  await customizationRepo.save({ customization: skillPersonal });
  return { manager, fs };
};

describe('CopilotAdapter — e2e idempotency (AC#15)', () => {
  it('second syncOne does not create new backups and keeps the symlink target unchanged', async () => {
    const { manager, fs } = await setup();

    await manager.syncOne({ customization: skillPersonal });
    const targetBefore = await fs.readlink(DESTINATION);
    const backupsBefore = await fs.pathExists(BACKUPS_ROOT);

    const results = await manager.syncOne({ customization: skillPersonal });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ adapter: 'copilot', status: 'ok' });
    expect(results[0]?.details).toBeUndefined();

    const targetAfter = await fs.readlink(DESTINATION);
    expect(targetAfter).toBe(targetBefore);

    const backupsAfter = await fs.pathExists(BACKUPS_ROOT);
    expect(backupsAfter).toBe(backupsBefore);
  });
});
