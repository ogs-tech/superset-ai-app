import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { InMemoryArtifactRepository } from '../../../../../src/main/infrastructure/artifact/in-memory-artifact-repository.js';
import { InMemorySettingsRepository } from '../../../../../src/main/infrastructure/settings/in-memory-settings-repository.js';
import { InMemoryFileSystem } from '../../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';
import { FixedClock } from '../../../../../src/main/infrastructure/clock/fixed-clock.js';
import { SymlinkManager } from '../../../../../src/main/application/services/symlink-manager.js';
import { AdapterManager } from '../../../../../src/main/application/services/adapter-manager.js';
import { SettingsService } from '../../../../../src/main/application/services/settings-service.js';
import { ClaudeAdapter } from '../../../../../src/main/infrastructure/adapters/claude-adapter.js';
import type { Artifact } from '../../../../../src/shared/artifact.js';
import type { Settings } from '../../../../../src/shared/settings.js';

const HOMEDIR = '/home/alice';
const WORKSPACE = '/workspace';

const baseSettings: Settings = {
  workspacePath: WORKSPACE,
  adapters: { claude: { enabled: true }, copilot: { enabled: true, exclusiveSkillsWithClaude: false } },
  linkedRepos: [],
  ui: { theme: 'system' },
};

const makeArtifact = (name: string): Artifact => ({
  id: `skill/${name}`,
  frontmatter: {
    name,
    type: 'skill',
    description: 'desc',
    scopes: ['personal'],
    version: '1.0.0',
    createdAt: '',
    updatedAt: '',
  },
  body: '# test',
});

describe('AdapterManager.countDestinations (AC#17)', () => {
  it('counts only symlinks pointing to workspace', async () => {
    const settingsRepo = new InMemorySettingsRepository();
    await settingsRepo.save(baseSettings);
    const settingsService = new SettingsService(settingsRepo);
    const artifactRepo = new InMemoryArtifactRepository();
    await artifactRepo.save({ artifact: makeArtifact('art1') });
    await artifactRepo.save({ artifact: makeArtifact('art2') });

    const fs = new InMemoryFileSystem();
    const dest1 = join(HOMEDIR, '.claude/skills/art1');
    const dest2 = join(HOMEDIR, '.claude/skills/art2');
    await fs.symlink({ target: join(WORKSPACE, 'skills/art1/SKILL.md'), path: dest1 });
    await fs.symlink({ target: join(WORKSPACE, 'skills/art2/SKILL.md'), path: dest2 });

    const sm = new SymlinkManager(fs, new FixedClock(new Date()), WORKSPACE);
    const claudeAdapter = new ClaudeAdapter({ homedir: HOMEDIR });
    const manager = new AdapterManager({
      settingsService,
      artifactRepository: artifactRepo,
      symlinkManager: sm,
      adapters: new Map([['claude', claudeAdapter]]),
    });

    const count = await manager.countDestinations('claude');
    expect(count).toBe(2);
  });
});
