import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { InMemoryCustomizationRepository } from '../../../../../src/main/infrastructure/customization/in-memory-customization-repository.js';
import { InMemorySettingsRepository } from '../../../../../src/main/infrastructure/settings/in-memory-settings-repository.js';
import { InMemoryFileSystem } from '../../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';
import { FixedClock } from '../../../../../src/main/infrastructure/clock/fixed-clock.js';
import { SymlinkManager } from '../../../../../src/main/application/services/symlink-manager.js';
import { AdapterManager } from '../../../../../src/main/application/services/adapter-manager.js';
import { SettingsService } from '../../../../../src/main/application/services/settings-service.js';
import { ClaudeAdapter } from '../../../../../src/main/infrastructure/adapters/claude-adapter.js';
import type { Customization } from '../../../../../src/shared/customization.js';
import type { Settings } from '../../../../../src/shared/settings.js';

const HOMEDIR = '/home/alice';
const WORKSPACE = '/workspace';

const baseSettings: Settings = {
  adapters: { claude: { enabled: true } },
  linkedRepos: [],
  ui: { theme: 'system' },
  language: 'off',
};

const skillCustomization: Customization = {
  id: 'skill/test',
  frontmatter: {
    name: 'test',
    type: 'skill',
    description: 'desc',
    scopes: ['personal'],
    version: '1.0.0',
    createdAt: '',
    updatedAt: '',
  },
  body: '# test',
};

const setup = async () => {
  const repo = new InMemorySettingsRepository();
  await repo.save(baseSettings);
  const settingsService = new SettingsService(repo);
  const customizationRepo = new InMemoryCustomizationRepository();
  await customizationRepo.save({ customization: skillCustomization });
  const fs = new InMemoryFileSystem();
  await fs.symlink({
    target: join(WORKSPACE, 'skills/test/SKILL.md'),
    path: join(HOMEDIR, '.claude/skills/test'),
  });
  const sm = new SymlinkManager(fs, new FixedClock(new Date()), WORKSPACE);
  const claudeAdapter = new ClaudeAdapter({ homedir: HOMEDIR });
  const manager = new AdapterManager({
    settingsService,
    customizationRepository: customizationRepo,
    symlinkManager: sm,
    workspacePath: WORKSPACE,
    adapters: new Map([['claude', claudeAdapter]]),
  });
  return { manager };
};

describe('AdapterManager.removeAdapterSymlinks — shape (AC#5)', () => {
  it('returns { removed, skipped, errors } with correct shape', async () => {
    const { manager } = await setup();

    const result = await manager.removeAdapterSymlinks('claude');

    expect(typeof result.removed).toBe('number');
    expect(typeof result.skipped).toBe('number');
    expect(Array.isArray(result.errors)).toBe(true);
  });
});
