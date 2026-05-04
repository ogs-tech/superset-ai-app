import { describe, expect, it, vi } from 'vitest';
import { buildHandlers } from '../../../src/main/ipc/registry.js';
import { SettingsService } from '../../../src/main/application/services/settings-service.js';
import { RepoService } from '../../../src/main/application/services/repo-service.js';
import { WorkspaceBootstrapService } from '../../../src/main/application/services/workspace-bootstrap.js';
import { ArtifactService } from '../../../src/main/application/services/artifact-service.js';
import { TemplateService } from '../../../src/main/application/services/template-service.js';
import { InMemoryArtifactRepository } from '../../../src/main/infrastructure/artifact/in-memory-artifact-repository.js';
import { FixedClock } from '../../../src/main/infrastructure/clock/fixed-clock.js';
import type { SettingsRepository } from '../../../src/main/application/ports/settings-repository.js';
import type { RepoReader } from '../../../src/main/application/ports/repo-reader.js';
import type { FileSystemMutator } from '../../../src/main/application/ports/file-system-mutator.js';
import type { DialogPort } from '../../../src/main/application/ports/dialog-port.js';
import type { EnvironmentPort } from '../../../src/main/application/ports/environment-port.js';
import type { PathProber } from '../../../src/main/application/ports/path-prober.js';
import type { TemplateRepository } from '../../../src/main/application/ports/template-repository.js';
import type { Template } from '../../../src/shared/artifact.js';
import type { AdapterManager } from '../../../src/main/application/services/adapter-manager.js';
import type { SearchService } from '../../../src/main/application/services/search-service.js';
import { DomainError } from '../../../src/main/domain/errors.js';
import type { LinkedRepo, Settings } from '../../../src/shared/settings.js';

const baseSettings = (overrides: Partial<Settings> = {}): Settings => ({
  workspacePath: '/tmp/workspace',
  adapters: {
    claude: { enabled: true },
    copilot: { enabled: false, exclusiveSkillsWithClaude: false },
  },
  linkedRepos: [],
  ui: { theme: 'system' },
  ...overrides,
});

interface Deps {
  settingsService: SettingsService;
  repoService: RepoService;
  workspaceBootstrap: WorkspaceBootstrapService;
  artifactService: ArtifactService;
  templateService: TemplateService;
  adapterManager: AdapterManager;
  searchService: SearchService;
  dialogPort: DialogPort;
  settingsRepoSpy: {
    load: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  repoReaderSpy: {
    exists: ReturnType<typeof vi.fn>;
    readFile: ReturnType<typeof vi.fn>;
  };
  fsMutatorSpy: {
    mkdirRecursive: ReturnType<typeof vi.fn>;
  };
  dialogSpy: {
    selectFolder: ReturnType<typeof vi.fn>;
  };
  pathProberSpy: {
    exists: ReturnType<typeof vi.fn>;
  };
  pathProber: PathProber;
  environmentPort: EnvironmentPort;
  environmentSpy: {
    getHomeDir: ReturnType<typeof vi.fn>;
  };
  artifactRepo: InMemoryArtifactRepository;
  clock: FixedClock;
  templateRepoSpy: {
    list: ReturnType<typeof vi.fn>;
  };
}

const buildDeps = (initial: Settings | null = baseSettings()): Deps => {
  const settingsRepoSpy = {
    load: vi.fn().mockResolvedValue(initial),
    save: vi.fn().mockResolvedValue(undefined),
  };
  const repo: SettingsRepository = {
    load: settingsRepoSpy.load,
    save: settingsRepoSpy.save,
  };

  const repoReaderSpy = {
    exists: vi.fn().mockResolvedValue(true),
    readFile: vi.fn().mockResolvedValue(''),
  };
  const reader: RepoReader = {
    exists: repoReaderSpy.exists,
    readFile: repoReaderSpy.readFile,
  };

  const fsMutatorSpy = {
    mkdirRecursive: vi.fn().mockResolvedValue(undefined),
  };
  const mutator: FileSystemMutator = {
    mkdirRecursive: fsMutatorSpy.mkdirRecursive,
  };

  const dialogSpy = {
    selectFolder: vi.fn().mockResolvedValue({ canceled: false, path: '/picked' }),
  };
  const dialogPort: DialogPort = {
    selectFolder: dialogSpy.selectFolder,
  };

  const pathProberSpy = {
    exists: vi.fn().mockResolvedValue(true),
  };
  const pathProber: PathProber = {
    exists: pathProberSpy.exists,
  };

  const environmentSpy = {
    getHomeDir: vi.fn().mockReturnValue('/Users/test'),
  };
  const environmentPort: EnvironmentPort = {
    getHomeDir: environmentSpy.getHomeDir,
  };

  const artifactRepo = new InMemoryArtifactRepository();
  const clock = new FixedClock(new Date('2026-04-26T10:00:00.000Z'));
  const adapterManager: AdapterManager = {
    syncAll: vi.fn().mockResolvedValue([]),
    syncOne: vi.fn().mockResolvedValue([]),
    removeOne: vi.fn().mockResolvedValue([]),
    removeAll: vi.fn().mockResolvedValue([]),
    removeAdapterSymlinks: vi.fn().mockResolvedValue({ removed: 0, skipped: 0, errors: [] }),
    countDestinations: vi.fn().mockResolvedValue(0),
  } as unknown as AdapterManager;
  const artifactService = new ArtifactService(artifactRepo, clock, adapterManager);

  const templateFixture: Template = {
    id: 'skill/default',
    type: 'skill',
    name: 'Default Skill',
    description: 'sample',
    frontmatter: { type: 'skill' },
    body: '# Default Skill\n',
    isBuiltIn: true,
  };
  const templateRepoSpy = {
    list: vi.fn().mockResolvedValue([templateFixture]),
  };
  const templateRepo: TemplateRepository = { list: templateRepoSpy.list };
  const templateService = new TemplateService(templateRepo);

  const searchService: Partial<SearchService> = {
    search: vi.fn().mockResolvedValue({ results: [], total: 0, truncated: false }),
  };

  return {
    settingsService: new SettingsService(repo),
    repoService: new RepoService(reader),
    workspaceBootstrap: new WorkspaceBootstrapService(mutator),
    artifactService,
    templateService,
    adapterManager,
    searchService: searchService as unknown as SearchService,
    dialogPort,
    pathProber,
    environmentPort,
    settingsRepoSpy,
    repoReaderSpy,
    fsMutatorSpy,
    dialogSpy,
    pathProberSpy,
    environmentSpy,
    artifactRepo,
    clock,
    templateRepoSpy,
  };
};

describe('buildHandlers', () => {
  it('registers settings.get and delegates to SettingsService', async () => {
    const deps = buildDeps();
    const handlers = buildHandlers(deps);

    expect(handlers).toHaveProperty('settings.get');
    const result = await handlers['settings.get']?.({});
    expect(result).toEqual(baseSettings());
    expect(deps.settingsRepoSpy.load).toHaveBeenCalledTimes(1);
  });

  it('settings.save persists the provided settings', async () => {
    const deps = buildDeps();
    const handlers = buildHandlers(deps);

    const next = baseSettings({ workspacePath: '/new' });
    const result = await handlers['settings.save']?.(next);

    expect(result).toBeUndefined();
    expect(deps.settingsRepoSpy.save).toHaveBeenCalledWith(next);
  });

  it('settings.merge applies a deep-merge and persists the consolidated state', async () => {
    const deps = buildDeps();
    const handlers = buildHandlers(deps);

    const merged = (await handlers['settings.merge']?.({
      adapters: { claude: { enabled: false } },
      ui: { theme: 'dark' },
    })) as Settings;

    expect(merged.adapters.claude.enabled).toBe(false);
    expect(merged.adapters.copilot).toEqual({
      enabled: false,
      exclusiveSkillsWithClaude: false,
    });
    expect(merged.ui.theme).toBe('dark');
    expect(deps.settingsRepoSpy.save).toHaveBeenCalledWith(merged);
  });

  it('repo.detectGit delegates to RepoService.detectGit', async () => {
    const deps = buildDeps();
    deps.repoReaderSpy.exists.mockResolvedValueOnce(true);
    const handlers = buildHandlers(deps);

    const result = await handlers['repo.detectGit']?.({ path: '/repo' });

    expect(result).toBe(true);
    expect(deps.repoReaderSpy.exists).toHaveBeenCalledWith('/repo/.git');
  });

  it('repo.getCurrentBranch delegates to RepoService.getCurrentBranch', async () => {
    const deps = buildDeps();
    deps.repoReaderSpy.exists.mockResolvedValue(true);
    deps.repoReaderSpy.readFile.mockResolvedValueOnce('ref: refs/heads/main\n');
    const handlers = buildHandlers(deps);

    const result = await handlers['repo.getCurrentBranch']?.({ path: '/repo' });

    expect(result).toBe('main');
  });

  it('repo.link rejects with validation DomainError when .git/ is absent', async () => {
    const deps = buildDeps();
    deps.repoReaderSpy.exists.mockResolvedValue(false);
    const handlers = buildHandlers(deps);

    await expect(
      handlers['repo.link']?.({ path: '/not-a-repo' }),
    ).rejects.toBeInstanceOf(DomainError);
    expect(deps.settingsRepoSpy.save).not.toHaveBeenCalled();
  });

  it('repo.link persists a new entry, returning a LinkedRepoView with branch', async () => {
    const deps = buildDeps(baseSettings());
    deps.repoReaderSpy.exists.mockResolvedValue(true);
    deps.repoReaderSpy.readFile.mockResolvedValue('ref: refs/heads/main\n');
    const handlers = buildHandlers(deps);

    const view = (await handlers['repo.link']?.({
      path: '/repos/foo',
      name: 'Foo',
    })) as { id: string; name: string; path: string; branch: string | null };

    expect(view.path).toBe('/repos/foo');
    expect(view.name).toBe('Foo');
    expect(view.branch).toBe('main');
    expect(view.id).toEqual(expect.any(String));

    const saved = deps.settingsRepoSpy.save.mock.calls[0]?.[0] as Settings;
    expect(saved.linkedRepos).toHaveLength(1);
    expect(saved.linkedRepos[0]).toEqual({
      id: view.id,
      name: 'Foo',
      path: '/repos/foo',
    });
  });

  it('repo.link deduplicates by path: linking the same path twice keeps a single entry', async () => {
    const existing: LinkedRepo = { id: 'abc', name: 'foo', path: '/repos/foo' };
    const deps = buildDeps(baseSettings({ linkedRepos: [existing] }));
    deps.repoReaderSpy.exists.mockResolvedValue(true);
    deps.repoReaderSpy.readFile.mockResolvedValue('ref: refs/heads/main\n');
    const handlers = buildHandlers(deps);

    await handlers['repo.link']?.({ path: '/repos/foo', name: 'foo' });

    const saved = deps.settingsRepoSpy.save.mock.calls[0]?.[0] as Settings;
    expect(saved.linkedRepos).toHaveLength(1);
    expect(saved.linkedRepos[0]).toEqual(existing);
  });

  it('repo.unlink removes the entry by id and persists', async () => {
    const a: LinkedRepo = { id: 'a', name: 'a', path: '/a' };
    const b: LinkedRepo = { id: 'b', name: 'b', path: '/b' };
    const deps = buildDeps(baseSettings({ linkedRepos: [a, b] }));
    const handlers = buildHandlers(deps);

    await handlers['repo.unlink']?.({ id: 'a' });

    const saved = deps.settingsRepoSpy.save.mock.calls[0]?.[0] as Settings;
    expect(saved.linkedRepos).toEqual([b]);
  });

  it('repo.list returns LinkedRepoView[] with branches recomputed via RepoService', async () => {
    const a: LinkedRepo = { id: 'a', name: 'a', path: '/a' };
    const b: LinkedRepo = { id: 'b', name: 'b', path: '/b' };
    const deps = buildDeps(baseSettings({ linkedRepos: [a, b] }));
    deps.repoReaderSpy.exists.mockResolvedValue(true);
    deps.repoReaderSpy.readFile
      .mockResolvedValueOnce('ref: refs/heads/main\n')
      .mockResolvedValueOnce('ref: refs/heads/dev\n');
    const handlers = buildHandlers(deps);

    const result = (await handlers['repo.list']?.({})) as Array<{
      id: string;
      name: string;
      path: string;
      branch: string | null;
    }>;

    expect(result).toEqual([
      { id: 'a', name: 'a', path: '/a', branch: 'main' },
      { id: 'b', name: 'b', path: '/b', branch: 'dev' },
    ]);
  });

  it('workspace.bootstrap delegates to WorkspaceBootstrapService.create', async () => {
    const deps = buildDeps();
    const handlers = buildHandlers(deps);

    const result = await handlers['workspace.bootstrap']?.({
      workspacePath: '/ws',
    });

    expect(result).toBeUndefined();
    expect(deps.fsMutatorSpy.mkdirRecursive).toHaveBeenCalled();
    const firstCall = deps.fsMutatorSpy.mkdirRecursive.mock.calls[0]?.[0] as string;
    expect(firstCall.startsWith('/ws/')).toBe(true);
  });

  it('workspace.exists delegates to PathProber.exists', async () => {
    const deps = buildDeps();
    deps.pathProberSpy.exists.mockResolvedValueOnce(false);
    const handlers = buildHandlers(deps);

    const result = await handlers['workspace.exists']?.({ path: '/missing' });

    expect(result).toBe(false);
    expect(deps.pathProberSpy.exists).toHaveBeenCalledWith('/missing');
  });

  it('app.getHomeDir delegates to EnvironmentPort.getHomeDir', async () => {
    const deps = buildDeps();
    deps.environmentSpy.getHomeDir.mockReturnValueOnce('/Users/odenir');
    const handlers = buildHandlers(deps);

    const result = await handlers['app.getHomeDir']?.({});

    expect(result).toBe('/Users/odenir');
    expect(deps.environmentSpy.getHomeDir).toHaveBeenCalledTimes(1);
  });

  it('dialog.selectFolder delegates to DialogPort.selectFolder', async () => {
    const deps = buildDeps();
    deps.dialogSpy.selectFolder.mockResolvedValueOnce({
      canceled: false,
      path: '/picked',
    });
    const handlers = buildHandlers(deps);

    const result = await handlers['dialog.selectFolder']?.({
      defaultPath: '/home',
    });

    expect(result).toEqual({ canceled: false, path: '/picked' });
    expect(deps.dialogSpy.selectFolder).toHaveBeenCalledWith({
      defaultPath: '/home',
    });
  });
});

describe('buildHandlers — artifact', () => {
  const sampleArtifact = {
    id: 'skill/foo',
    frontmatter: {
      name: 'foo',
      type: 'skill',
      description: 'sample',
      scopes: ['personal'],
      version: '0.1.0',
      createdAt: '',
      updatedAt: '',
    },
    body: '# Foo\n',
  };

  it('artifact.save returns { artifact, syncReport: [] }', async () => {
    const deps = buildDeps();
    const handlers = buildHandlers(deps);

    const result = (await handlers['artifact.save']?.({
      artifact: sampleArtifact,
    })) as { artifact: { id: string }; syncReport: unknown[] };

    expect(result.artifact.id).toBe('skill/foo');
    expect(result.syncReport).toEqual([]);
  });

  it('artifact.save validation error surfaces as DomainError (envelope-mapped by dispatcher)', async () => {
    const deps = buildDeps();
    const handlers = buildHandlers(deps);

    const broken = {
      ...sampleArtifact,
      frontmatter: { ...sampleArtifact.frontmatter, name: '' },
    };
    await expect(handlers['artifact.save']?.({ artifact: broken })).rejects.toMatchObject({
      kind: 'validation',
    });
  });

  it('artifact.list filters by type when provided', async () => {
    const deps = buildDeps();
    const handlers = buildHandlers(deps);
    await handlers['artifact.save']?.({ artifact: sampleArtifact });

    const result = (await handlers['artifact.list']?.({ type: 'skill' })) as Array<{
      id: string;
    }>;
    expect(result.map((a) => a.id)).toEqual(['skill/foo']);
  });

  it('artifact.list returns all when type is omitted', async () => {
    const deps = buildDeps();
    const handlers = buildHandlers(deps);
    await handlers['artifact.save']?.({ artifact: sampleArtifact });

    const result = (await handlers['artifact.list']?.({})) as Array<{ id: string }>;
    expect(result).toHaveLength(1);
  });

  it('artifact.list accepts type "global-instruction" without rejection (regression: spec 014)', async () => {
    const deps = buildDeps();
    const handlers = buildHandlers(deps);

    const result = (await handlers['artifact.list']?.({
      type: 'global-instruction',
    })) as Array<{ id: string }>;
    expect(result).toEqual([]);
  });

  it('template.list accepts type "global-instruction" without rejection (regression: spec 014)', async () => {
    const deps = buildDeps();
    const handlers = buildHandlers(deps);

    await expect(
      handlers['template.list']?.({ type: 'global-instruction' }),
    ).resolves.toBeDefined();
  });

  it('artifact.get returns the artifact', async () => {
    const deps = buildDeps();
    const handlers = buildHandlers(deps);
    await handlers['artifact.save']?.({ artifact: sampleArtifact });

    const result = (await handlers['artifact.get']?.({ id: 'skill/foo' })) as {
      id: string;
    };
    expect(result.id).toBe('skill/foo');
  });

  it('artifact.delete removes the artifact and accepts removeSymlinks flag', async () => {
    const deps = buildDeps();
    const handlers = buildHandlers(deps);
    await handlers['artifact.save']?.({ artifact: sampleArtifact });

    const result = (await handlers['artifact.delete']?.({
      id: 'skill/foo',
      removeSymlinks: true,
    })) as { ok: true; syncReport: unknown[] };
    expect(result).toEqual({ ok: true, syncReport: [] });

    expect(await deps.artifactRepo.exists({ id: 'skill/foo' })).toBe(false);
  });

  it('artifact.delete rejects when removeSymlinks is missing', async () => {
    const deps = buildDeps();
    const handlers = buildHandlers(deps);

    await expect(
      handlers['artifact.delete']?.({ id: 'skill/foo' }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it('template.list delegates to TemplateService with the requested type', async () => {
    const deps = buildDeps();
    const handlers = buildHandlers(deps);

    const result = (await handlers['template.list']?.({ type: 'skill' })) as Template[];
    expect(deps.templateRepoSpy.list).toHaveBeenCalledWith({ type: 'skill' });
    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe('skill');
  });

  it('template.list rejects unknown type with kind=validation', async () => {
    const deps = buildDeps();
    const handlers = buildHandlers(deps);

    await expect(
      handlers['template.list']?.({ type: 'unknown' }),
    ).rejects.toMatchObject({ kind: 'validation' });
  });
});
