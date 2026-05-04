import { describe, expect, it } from 'vitest';
import { ArtifactService } from '../../../../../src/main/application/services/artifact-service.js';
import { SymlinkManager } from '../../../../../src/main/application/services/symlink-manager.js';
import { AdapterManager } from '../../../../../src/main/application/services/adapter-manager.js';
import { SettingsService } from '../../../../../src/main/application/services/settings-service.js';
import { FakeAdapter } from '../../../../../src/main/application/services/__fixtures__/fake-adapter.js';
import { InMemoryArtifactRepository } from '../../../../../src/main/infrastructure/artifact/in-memory-artifact-repository.js';
import { InMemorySettingsRepository } from '../../../../../src/main/infrastructure/settings/in-memory-settings-repository.js';
import { InMemoryFileSystem } from '../../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';
import { FixedClock } from '../../../../../src/main/infrastructure/clock/fixed-clock.js';
import type { Artifact, ArtifactFrontmatter } from '../../../../../src/shared/artifact.js';
import type { Settings } from '../../../../../src/shared/settings.js';

const FROZEN = new Date('2026-04-26T10:00:00.000Z');
const WORKSPACE = '/workspace';

const settings: Settings = {
  workspacePath: WORKSPACE,
  adapters: {
    claude: { enabled: true },
    copilot: { enabled: false, exclusiveSkillsWithClaude: false },
  },
  linkedRepos: [],
  ui: { theme: 'system' },
};

const validFrontmatter = (
  overrides: Partial<ArtifactFrontmatter> = {},
): ArtifactFrontmatter => ({
  name: 'foo',
  type: 'skill',
  description: 'sample skill',
  scopes: ['personal'],
  version: '0.1.0',
  createdAt: '',
  updatedAt: '',
  ...overrides,
});

const makeArtifact = (overrides: Partial<Artifact> = {}): Artifact => ({
  id: 'skill/foo',
  frontmatter: validFrontmatter(),
  body: '# Foo\n',
  ...overrides,
});

const setup = async () => {
  const settingsRepo = new InMemorySettingsRepository();
  await settingsRepo.save(settings);
  const settingsService = new SettingsService(settingsRepo);
  const artifactRepo = new InMemoryArtifactRepository();
  const fs = new InMemoryFileSystem();
  const clock = new FixedClock(FROZEN);
  const symlinkManager = new SymlinkManager(fs, clock, WORKSPACE);
  const claudeAdapter = new FakeAdapter('claude', '/personal/claude/skills/foo');
  const adapterManager = new AdapterManager({
    settingsService,
    artifactRepository: artifactRepo,
    symlinkManager,
    adapters: new Map([[claudeAdapter.adapterId, claudeAdapter]]),
  });
  const service = new ArtifactService(artifactRepo, clock, adapterManager);
  return { service, fs, adapterManager };
};

describe('ArtifactService.save — syncReport population', () => {
  it('populates syncReport with SyncResult[] from AdapterManager.syncOne', async () => {
    const { service } = await setup();

    const result = await service.save({ artifact: makeArtifact() });

    expect(result.syncReport).toHaveLength(1);
    expect(result.syncReport[0]).toMatchObject({
      adapter: 'claude',
      destination: '/personal/claude/skills/foo',
      status: 'ok',
    });
  });

  it('idempotent re-save does not create new entries in _backups/', async () => {
    const { service, fs } = await setup();

    await service.save({ artifact: makeArtifact() });
    const backupsBefore = await listBackups(fs);

    const second = await service.save({ artifact: makeArtifact({ body: '# Foo updated\n' }) });
    const backupsAfter = await listBackups(fs);

    expect(second.syncReport).toHaveLength(1);
    expect(second.syncReport[0]?.status).toBe('ok');
    expect(backupsAfter).toEqual(backupsBefore);
  });
});

async function listBackups(fs: InMemoryFileSystem): Promise<string[]> {
  const exists = await fs.pathExists(`${WORKSPACE}/_backups`);
  if (!exists) return [];
  return fs.readdir(`${WORKSPACE}/_backups`);
}
