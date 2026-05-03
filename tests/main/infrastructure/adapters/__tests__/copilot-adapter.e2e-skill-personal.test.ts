import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { CopilotAdapter } from '../../../../../src/main/infrastructure/adapters/copilot-adapter.js';
import { InMemoryArtifactRepository } from '../../../../../src/main/infrastructure/artifact/in-memory-artifact-repository.js';
import { InMemoryFileSystem } from '../../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';
import { InMemorySettingsRepository } from '../../../../../src/main/infrastructure/settings/in-memory-settings-repository.js';
import { FixedClock } from '../../../../../src/main/infrastructure/clock/fixed-clock.js';
import { SymlinkManager } from '../../../../../src/main/application/services/symlink-manager.js';
import { AdapterManager } from '../../../../../src/main/application/services/adapter-manager.js';
import { SettingsService } from '../../../../../src/main/application/services/settings-service.js';
import type { Adapter } from '../../../../../src/main/application/ports/adapter.js';
import type { Artifact } from '../../../../../src/shared/artifact.js';
import type { Settings } from '../../../../../src/shared/settings.js';

const HOMEDIR = '/Users/alice';
const WORKSPACE = '/workspace';

const skillPersonal: Artifact = {
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
    copilot: { enabled: true },
  },
  linkedRepos: [],
  ui: { theme: 'system' },
});

const setup = async () => {
  const settingsRepo = new InMemorySettingsRepository();
  await settingsRepo.save(buildSettings());
  const settingsService = new SettingsService(settingsRepo);
  const artifactRepo = new InMemoryArtifactRepository();
  const fs = new InMemoryFileSystem();
  fs.createFile(join(WORKSPACE, 'skills/review'), '# review\n');
  const clock = new FixedClock(new Date('2026-04-26T10:00:00.000Z'));
  const symlinkManager = new SymlinkManager(fs, clock, WORKSPACE);
  const copilotAdapter = new CopilotAdapter({ homedir: HOMEDIR });
  const manager = new AdapterManager({
    settingsService,
    artifactRepository: artifactRepo,
    symlinkManager,
    adapters: new Map<string, Adapter>([[copilotAdapter.adapterId, copilotAdapter]]),
  });
  await artifactRepo.save({ artifact: skillPersonal });
  return { manager, fs };
};

describe('CopilotAdapter — e2e skill personal (AC#10, AC#12)', () => {
  it('syncOne creates symlink at <homedir>/.copilot/skills/<slug> resolving to <workspace>/skills/<slug>', async () => {
    const { manager, fs } = await setup();

    const results = await manager.syncOne({ artifact: skillPersonal });

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
