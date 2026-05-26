import { describe, expect, it, vi } from 'vitest';
import { buildHandlers } from '../../../src/main/ipc/registry.js';
import { SettingsService } from '../../../src/main/application/services/settings-service.js';
import { RepoService } from '../../../src/main/application/services/repo-service.js';
import { CustomizationService } from '../../../src/main/application/services/customization-service.js';
import { TemplateService } from '../../../src/main/application/services/template-service.js';
import { InMemoryCustomizationRepository } from '../../../src/main/infrastructure/customization/in-memory-customization-repository.js';
import { FixedClock } from '../../../src/main/infrastructure/clock/fixed-clock.js';
import type { SettingsRepository } from '../../../src/main/application/ports/settings-repository.js';
import type { RepoReader } from '../../../src/main/application/ports/repo-reader.js';
import type { DialogPort } from '../../../src/main/application/ports/dialog-port.js';
import type { TemplateRepository } from '../../../src/main/application/ports/template-repository.js';
import type { Template, TemplateFrontmatter } from '../../../src/shared/template.js';
import type { AdapterManager } from '../../../src/main/application/services/adapter-manager.js';
import type { PluginService } from '../../../src/main/application/services/plugin-service.js';
import type { SkillService } from '../../../src/main/application/services/skill-service.js';
import type { AgentService } from '../../../src/main/application/services/agent-service.js';
import type { CommandService } from '../../../src/main/application/services/command-service.js';
import type { ReferenceService } from '../../../src/main/application/services/reference-service.js';
import type { GlobalInstructionService } from '../../../src/main/application/services/global-instruction-service.js';
import type { MarketplaceService } from '../../../src/main/application/services/marketplace-service.js';
import type { CredentialStorePort } from '../../../src/main/application/ports/credential-store-port.js';
import { DomainError } from '../../../src/main/domain/errors.js';
import type { LinkedRepo, Settings } from '../../../src/shared/settings.js';

const baseSettings = (overrides: Partial<Settings> = {}): Settings => ({
  adapters: {
    claude: { enabled: true },
    copilot: { enabled: false, exclusiveSkillsWithClaude: false },
  },
  linkedRepos: [],
  ui: { theme: 'system' },
  language: 'off',
  ...overrides,
});

interface Deps {
  settingsService: SettingsService;
  repoService: RepoService;
  customizationService: CustomizationService;
  templateService: TemplateService;
  adapterManager: AdapterManager;
  dialogPort: DialogPort;
  pluginService: PluginService;
  credentialStore: CredentialStorePort;
  skillService: SkillService;
  agentService: AgentService;
  commandService: CommandService;
  referenceService: ReferenceService;
  globalInstructionService: GlobalInstructionService;
  marketplaceService: MarketplaceService;
  settingsRepoSpy: {
    load: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  repoReaderSpy: {
    exists: ReturnType<typeof vi.fn>;
    readFile: ReturnType<typeof vi.fn>;
  };
  dialogSpy: {
    selectFolder: ReturnType<typeof vi.fn>;
  };
  customizationRepo: InMemoryCustomizationRepository;
  clock: FixedClock;
  templateRepoSpy: {
    list: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    exists: ReturnType<typeof vi.fn>;
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

  const dialogSpy = {
    selectFolder: vi.fn().mockResolvedValue({ canceled: false, path: '/picked' }),
  };
  const dialogPort: DialogPort = {
    selectFolder: dialogSpy.selectFolder,
  };

  const customizationRepo = new InMemoryCustomizationRepository();
  const clock = new FixedClock(new Date('2026-04-26T10:00:00.000Z'));
  const adapterManager: AdapterManager = {
    syncAll: vi.fn().mockResolvedValue([]),
    syncOne: vi.fn().mockResolvedValue([]),
    removeOne: vi.fn().mockResolvedValue([]),
    removeAll: vi.fn().mockResolvedValue([]),
    removeAdapterSymlinks: vi.fn().mockResolvedValue({ removed: 0, skipped: 0, errors: [] }),
    countDestinations: vi.fn().mockResolvedValue(0),
  } as unknown as AdapterManager;
  const customizationService = new CustomizationService(customizationRepo, clock, adapterManager);

  const templateFrontmatter: TemplateFrontmatter = {
    name: 'default',
    targetType: 'skill',
    description: 'sample',
    scopes: ['personal'],
    version: '0.1.0',
    createdAt: '2026-04-26T10:00:00.000Z',
    updatedAt: '2026-04-26T10:00:00.000Z',
  };
  const templateFixture: Template = {
    id: 'template/default',
    frontmatter: templateFrontmatter,
    body: '# Default\n',
  };
  const templateRepoSpy = {
    list: vi.fn().mockResolvedValue([templateFixture]),
    get: vi.fn().mockResolvedValue(templateFixture),
    save: vi.fn().mockResolvedValue(templateFixture),
    delete: vi.fn().mockResolvedValue(undefined),
    exists: vi.fn().mockResolvedValue(false),
  };
  const templateRepo: TemplateRepository = {
    list: templateRepoSpy.list,
    get: templateRepoSpy.get,
    save: templateRepoSpy.save,
    delete: templateRepoSpy.delete,
    exists: templateRepoSpy.exists,
  };
  const templateService = new TemplateService(templateRepo, clock);

  const pluginService = null as unknown as PluginService;
  const skillService = null as unknown as SkillService;
  const agentService = null as unknown as AgentService;
  const commandService = null as unknown as CommandService;
  const referenceService = null as unknown as ReferenceService;
  const globalInstructionService = null as unknown as GlobalInstructionService;
  const marketplaceService = null as unknown as MarketplaceService;
  const credentialStore: CredentialStorePort = {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    isAvailable: vi.fn().mockResolvedValue(true),
  };

  return {
    settingsService: new SettingsService(repo),
    repoService: new RepoService(reader),
    customizationService,
    templateService,
    adapterManager,
    dialogPort,
    pluginService,
    credentialStore,
    skillService,
    agentService,
    commandService,
    referenceService,
    globalInstructionService,
    marketplaceService,
    settingsRepoSpy,
    repoReaderSpy,
    dialogSpy,
    customizationRepo,
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

    const next = baseSettings({ ui: { theme: 'dark' } });
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
      language: 'off',
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

describe('buildHandlers — templates', () => {
  it('template.list accepts targetType "global-instruction" without rejection', async () => {
    const deps = buildDeps();
    const handlers = buildHandlers(deps);

    await expect(
      handlers['template.list']?.({ targetType: 'global-instruction' }),
    ).resolves.toBeDefined();
  });

  it('template.list delegates to TemplateService with the requested targetType', async () => {
    const deps = buildDeps();
    const handlers = buildHandlers(deps);

    const result = (await handlers['template.list']?.({ targetType: 'skill' })) as Template[];
    expect(deps.templateRepoSpy.list).toHaveBeenCalledWith({ targetType: 'skill' });
    expect(result).toHaveLength(1);
    expect(result[0]!.frontmatter.targetType).toBe('skill');
  });

  it('template.list rejects unknown targetType with kind=validation', async () => {
    const deps = buildDeps();
    const handlers = buildHandlers(deps);

    await expect(
      handlers['template.list']?.({ targetType: 'unknown' }),
    ).rejects.toMatchObject({ kind: 'validation' });
  });
});
