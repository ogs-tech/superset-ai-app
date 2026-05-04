import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { InMemoryArtifactRepository } from '../../../../src/main/infrastructure/artifact/in-memory-artifact-repository.js';
import { InMemorySettingsRepository } from '../../../../src/main/infrastructure/settings/in-memory-settings-repository.js';
import { InMemoryFileSystem } from '../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';
import { FixedClock } from '../../../../src/main/infrastructure/clock/fixed-clock.js';
import { SymlinkManager } from '../../../../src/main/application/services/symlink-manager.js';
import { AdapterManager } from '../../../../src/main/application/services/adapter-manager.js';
import { SettingsService } from '../../../../src/main/application/services/settings-service.js';
import { ClaudeAdapter } from '../../../../src/main/infrastructure/adapters/claude-adapter.js';
import type { Artifact } from '../../../../src/shared/artifact.js';
import type { Settings } from '../../../../src/shared/settings.js';

const HOMEDIR = '/home/alice';
const WORKSPACE = '/workspace';

const baseSettings: Settings = {
  workspacePath: WORKSPACE,
  adapters: { claude: { enabled: true }, copilot: { enabled: false, exclusiveSkillsWithClaude: false } },
  linkedRepos: [],
  ui: { theme: 'system' },
};

const skillPersonal: Artifact = {
  id: 'skill/my-skill',
  frontmatter: { name: 'my-skill', type: 'skill', description: 'desc', scopes: ['personal'], version: '1.0.0', createdAt: '', updatedAt: '' },
  body: '# skill',
};

describe('disable-claude-external-symlink e2e (AC#13)', () => {
  it('external symlink is skipped and remains after removeAdapterSymlinks', async () => {
    const settingsRepo = new InMemorySettingsRepository();
    await settingsRepo.save(baseSettings);
    const settingsService = new SettingsService(settingsRepo);
    const artifactRepo = new InMemoryArtifactRepository();
    await artifactRepo.save({ artifact: skillPersonal });

    const fs = new InMemoryFileSystem();
    const dest = join(HOMEDIR, '.claude/skills/my-skill');
    await fs.symlink({ target: '/tmp/external-target', path: dest });

    const sm = new SymlinkManager(fs, new FixedClock(new Date()), WORKSPACE);
    const claudeAdapter = new ClaudeAdapter({ homedir: HOMEDIR });
    const manager = new AdapterManager({
      settingsService,
      artifactRepository: artifactRepo,
      symlinkManager: sm,
      adapters: new Map([['claude', claudeAdapter]]),
    });

    const result = await manager.removeAdapterSymlinks('claude');

    expect(result.skipped).toBe(1);
    expect(result.removed).toBe(0);
    const entry = await fs.lstat(dest);
    expect(entry.kind).toBe('symlink');
  });
});
