import { describe, expect, it, vi } from 'vitest';
import { buildHandlers } from '../../../src/main/ipc/registry.js';
import { SettingsService } from '../../../src/main/application/services/settings-service.js';
import { RepoService } from '../../../src/main/application/services/repo-service.js';
import { WorkspaceBootstrapService } from '../../../src/main/application/services/workspace-bootstrap.js';
import type { SettingsRepository } from '../../../src/main/application/ports/settings-repository.js';
import type { RepoReader } from '../../../src/main/application/ports/repo-reader.js';
import type { FileSystemMutator } from '../../../src/main/application/ports/file-system-mutator.js';
import type { DialogPort } from '../../../src/main/application/ports/dialog-port.js';
import type { EnvironmentPort } from '../../../src/main/application/ports/environment-port.js';
import type { PathProber } from '../../../src/main/application/ports/path-prober.js';
import { DomainError } from '../../../src/main/domain/errors.js';
import type { LinkedRepo, Settings } from '../../../src/shared/settings.js';

const baseSettings = (overrides: Partial<Settings> = {}): Settings => ({
  workspacePath: '/tmp/workspace',
  adapters: {
    claude: { enabled: true, defaultScope: 'personal' },
    copilot: { enabled: false, defaultScope: 'personal' },
  },
  linkedRepos: [],
  ui: { theme: 'system' },
  ...overrides,
});

interface Deps {
  settingsService: SettingsService;
  repoService: RepoService;
  workspaceBootstrap: WorkspaceBootstrapService;
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

  return {
    settingsService: new SettingsService(repo),
    repoService: new RepoService(reader),
    workspaceBootstrap: new WorkspaceBootstrapService(mutator),
    dialogPort,
    pathProber,
    environmentPort,
    settingsRepoSpy,
    repoReaderSpy,
    fsMutatorSpy,
    dialogSpy,
    pathProberSpy,
    environmentSpy,
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
      defaultScope: 'personal',
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
