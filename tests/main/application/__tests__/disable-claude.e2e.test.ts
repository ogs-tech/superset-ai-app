import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { InMemoryCustomizationRepository } from '../../../../src/main/infrastructure/customization/in-memory-customization-repository.js';
import { InMemorySettingsRepository } from '../../../../src/main/infrastructure/settings/in-memory-settings-repository.js';
import { InMemoryFileSystem } from '../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';
import { FixedClock } from '../../../../src/main/infrastructure/clock/fixed-clock.js';
import { SymlinkManager } from '../../../../src/main/application/services/symlink-manager.js';
import { AdapterManager } from '../../../../src/main/application/services/adapter-manager.js';
import { SettingsService } from '../../../../src/main/application/services/settings-service.js';
import { ClaudeAdapter } from '../../../../src/main/infrastructure/adapters/claude-adapter.js';
import type { Customization } from '../../../../src/shared/customization.js';
import type { Settings } from '../../../../src/shared/settings.js';

const HOMEDIR = '/home/alice';
const WORKSPACE = '/workspace';

const baseSettings: Settings = {
  adapters: { claude: { enabled: true }, copilot: { enabled: false, exclusiveSkillsWithClaude: false } },
  linkedRepos: [{ id: 'r1', name: 'r1', path: '/repos/r1' }],
  ui: { theme: 'system' },
  language: 'off',
};

const skillPersonal: Customization = {
  id: 'skill/my-skill',
  frontmatter: { name: 'my-skill', type: 'skill', description: 'desc', scopes: ['personal'], version: '1.0.0', createdAt: '', updatedAt: '' },
  body: '# skill',
};

const agentPersonal: Customization = {
  id: 'agent/my-agent',
  frontmatter: { name: 'my-agent', type: 'agent', description: 'desc', scopes: ['personal'], version: '1.0.0', createdAt: '', updatedAt: '' },
  body: '# agent',
};

const skillProject: Customization = {
  id: 'skill/proj-skill',
  frontmatter: { name: 'proj-skill', type: 'skill', description: 'desc', scopes: ['project'], version: '1.0.0', createdAt: '', updatedAt: '' },
  body: '# proj skill',
};

const skillRealFile: Customization = {
  id: 'skill/real-skill',
  frontmatter: { name: 'real-skill', type: 'skill', description: 'desc', scopes: ['personal'], version: '1.0.0', createdAt: '', updatedAt: '' },
  body: '# real skill',
};

describe('disable-claude e2e (AC#10)', () => {
  it('removes workspace symlinks and skips real file', async () => {
    const settingsRepo = new InMemorySettingsRepository();
    await settingsRepo.save(baseSettings);
    const settingsService = new SettingsService(settingsRepo);
    const customizationRepo = new InMemoryCustomizationRepository();
    await customizationRepo.save({ customization: skillPersonal });
    await customizationRepo.save({ customization: agentPersonal });
    await customizationRepo.save({ customization: skillProject });
    await customizationRepo.save({ customization: skillRealFile });

    const fs = new InMemoryFileSystem();
    const symlinkPersonalSkill = join(HOMEDIR, '.claude/skills/my-skill');
    const symlinkPersonalAgent = join(HOMEDIR, '.claude/agents/my-agent.md');
    const symlinkProjectSkill = join('/repos/r1', '.claude/skills/proj-skill');
    const realFile = join(HOMEDIR, '.claude/skills/real-skill');

    await fs.symlink({ target: join(WORKSPACE, 'skills/my-skill'), path: symlinkPersonalSkill });
    await fs.symlink({ target: join(WORKSPACE, 'agents/my-agent.md'), path: symlinkPersonalAgent });
    await fs.symlink({ target: join(WORKSPACE, 'skills/proj-skill'), path: symlinkProjectSkill });
    fs.createFile(realFile, 'real content');

    const sm = new SymlinkManager(fs, new FixedClock(new Date()), WORKSPACE);
    const claudeAdapter = new ClaudeAdapter({ homedir: HOMEDIR });
    const manager = new AdapterManager({
      settingsService,
      customizationRepository: customizationRepo,
      symlinkManager: sm,
      workspacePath: WORKSPACE,
      adapters: new Map([['claude', claudeAdapter]]),
    });

    const result = await manager.removeAdapterSymlinks('claude');

    expect(result.removed).toBe(3);
    expect(result.skipped).toBe(1);
    expect(result.errors).toHaveLength(0);

    const realEntry = await fs.lstat(realFile);
    expect(realEntry.kind).toBe('file');
  });
});
