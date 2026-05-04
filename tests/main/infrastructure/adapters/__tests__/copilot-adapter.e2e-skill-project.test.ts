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
import type { LinkedRepo, Settings } from '../../../../../src/shared/settings.js';

const HOMEDIR = '/Users/alice';
const WORKSPACE = '/workspace';

const skillProject: Customization = {
  id: 'skill/review',
  frontmatter: {
    name: 'review',
    type: 'skill',
    description: 'desc',
    scopes: ['project'],
    version: '1.0.0',
    createdAt: '',
    updatedAt: '',
  },
  body: '# review',
};

const repos: LinkedRepo[] = [
  { id: 'r1', name: 'r1', path: '/repos/r1' },
  { id: 'r2', name: 'r2', path: '/repos/r2' },
];

const buildSettings = (): Settings => ({
  workspacePath: WORKSPACE,
  adapters: {
    claude: { enabled: false },
    copilot: { enabled: true, exclusiveSkillsWithClaude: false },
  },
  linkedRepos: repos,
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
  await customizationRepo.save({ customization: skillProject });
  return { manager, fs };
};

describe('CopilotAdapter — e2e skill project (AC#13)', () => {
  it('syncOne with 2 linkedRepos creates 2 symlinks under <repo>/.github/skills/<slug>', async () => {
    const { manager, fs } = await setup();

    const results = await manager.syncOne({ customization: skillProject });

    const ok = results.filter((r) => r.adapter === 'copilot' && r.status === 'ok');
    expect(ok).toHaveLength(2);

    const expectedTarget = join(WORKSPACE, 'skills', 'review');
    for (const repo of repos) {
      const dest = join(repo.path, '.github/skills', 'review');
      expect(ok.some((r) => r.destination === dest)).toBe(true);
      const target = await fs.readlink(dest);
      expect(target).toBe(expectedTarget);
    }
  });
});
