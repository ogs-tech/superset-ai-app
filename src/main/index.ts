import { app, BrowserWindow, ipcMain } from 'electron';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { IPC_CHANNEL } from '../shared/ipc-contract.js';
import { SettingsService } from './application/services/settings-service.js';
import { RepoService } from './application/services/repo-service.js';
import { WorkspaceBootstrapService } from './application/services/workspace-bootstrap.js';
import { CustomizationService } from './application/services/customization-service.js';
import { AdapterManager } from './application/services/adapter-manager.js';
import { SymlinkManager } from './application/services/symlink-manager.js';
import { FsSettingsRepository } from './infrastructure/settings/fs-settings-repository.js';
import { FsRepoReader } from './infrastructure/repo/fs-repo-reader.js';
import { FsWorkspaceBootstrap } from './infrastructure/workspace/fs-workspace-bootstrap.js';
import { FsCustomizationRepository } from './infrastructure/customization/fs-customization-repository.js';
import { SystemClock } from './infrastructure/clock/system-clock.js';
import { ElectronDialogAdapter } from './infrastructure/dialog/electron-dialog-adapter.js';
import { NodeFsAdapter } from './infrastructure/filesystem/node-fs-adapter.js';
import { ClaudeAdapter } from './infrastructure/adapters/claude-adapter.js';
import { SchemaValidator } from './application/services/schema-validator.js';
import type { Adapter } from './application/ports/adapter.js';
import type { CredentialStorePort } from './application/ports/credential-store-port.js';
import { SafeStorageCredentials } from './infrastructure/credentials/safe-storage-credentials.js';
import { SimpleGitClient } from './infrastructure/git/simple-git-client.js';
import { PluginCacheFile } from './infrastructure/plugins/plugin-cache-file.js';
import { ClaudeSettingsFile } from './infrastructure/settings/claude-settings-file.js';
import { OctokitClient } from './infrastructure/github/octokit-client.js';
import { PluginManifestParser } from './application/services/plugin-manifest-parser.js';
import { MarketplaceParser } from './application/services/marketplace-parser.js';
import { PluginInstaller } from './application/services/plugin-installer.js';
import { PluginAuthorService } from './application/services/plugin-author-service.js';
import { PluginPublisher } from './application/services/plugin-publisher.js';
import { PluginService } from './application/services/plugin-service.js';
import { PluginProvenanceService } from './application/services/plugin-provenance.js';
import { SkillService } from './application/services/skill-service.js';
import { AgentService } from './application/services/agent-service.js';
import { CommandService } from './application/services/command-service.js';
import { HookService } from './application/services/hook-service.js';
import { GlobalInstructionService } from './application/services/global-instruction-service.js';
import { MarketplaceService } from './application/services/marketplace-service.js';
import { MarketplaceSeeder } from './application/services/marketplace-seeder.js';
import { SettingsMarketplaceRepository } from './infrastructure/marketplace/settings-marketplace-repository.js';
import { FsClaudeRuntimeReader } from './infrastructure/claude-runtime/fs-claude-runtime-reader.js';
import { ElectronNotificationAdapter } from './infrastructure/notification/electron-notification-adapter.js';
import { HealthService } from './application/services/health/health-service.js';
import { McpAuthCollector } from './application/services/health/mcp-auth-collector.js';
import { McpRuntimeCollector } from './application/services/health/mcp-runtime-collector.js';
import { ConfigDriftCollector } from './application/services/health/config-drift-collector.js';
import { SymlinkCollector } from './application/services/health/symlink-collector.js';
import type { HealthCollector } from './application/services/health/health-collector.js';
import { buildHandlers } from './ipc/registry.js';
import { createDispatcher } from './ipc/dispatcher.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface IpcCallPayload {
  method: string;
  params: unknown;
}

function isCallPayload(value: unknown): value is IpcCallPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    'method' in value &&
    typeof (value as { method: unknown }).method === 'string'
  );
}

async function wireIpc(): Promise<void> {
  const workspacePath = join(homedir(), '.superset-ai-app');

  const workspaceBootstrap = new WorkspaceBootstrapService(new FsWorkspaceBootstrap());
  await workspaceBootstrap.create(workspacePath);

  const settingsService = new SettingsService(
    new FsSettingsRepository(join(workspacePath, 'settings.json')),
  );
  const repoReader = new FsRepoReader();
  const repoService = new RepoService(repoReader);
  const dialogPort = new ElectronDialogAdapter();

  const clock = new SystemClock();
  const customizationRepo = new FsCustomizationRepository(workspacePath);

  const symlinkManager = new SymlinkManager(new NodeFsAdapter(), clock, workspacePath);
  const nodeFsAdapter = new NodeFsAdapter();
  const claudeAdapter = new ClaudeAdapter({ homedir: homedir() });
  const adapterManager = new AdapterManager({
    settingsService,
    customizationRepository: customizationRepo,
    symlinkManager,
    workspacePath,
    adapters: new Map<string, Adapter>([
      [claudeAdapter.adapterId, claudeAdapter],
    ]),
  });
  const schemaValidator = new SchemaValidator();
  const customizationService = new CustomizationService(customizationRepo, clock, adapterManager, schemaValidator);

  const credentialStore: CredentialStorePort = new SafeStorageCredentials(app.getPath('userData'));

  // T10.1: wire full PluginService
  const gitClient = new SimpleGitClient();

  const pluginsWorkspaceDir = join(workspacePath, 'plugins');
  const pluginCache = new PluginCacheFile({
    pluginsDir: (scope) =>
      scope === 'personal'
        ? pluginsWorkspaceDir
        : join(process.cwd(), '.superset-ai-app', 'plugins'),
    cacheDir: (scope) =>
      scope === 'personal'
        ? join(homedir(), '.claude', 'plugins', 'cache', 'local')
        : join(process.cwd(), '.claude', 'plugins', 'cache', 'local'),
  });

  const claudeSettingsFile = new ClaudeSettingsFile({
    settingsPath: (scope) =>
      scope === 'personal'
        ? join(homedir(), '.claude', 'settings.json')
        : join(process.cwd(), '.claude', 'settings.json'),
    symlinkPath: (scope, id) =>
      scope === 'personal'
        ? join(homedir(), '.claude', 'plugins', 'cache', 'local', id)
        : join(process.cwd(), '.claude', 'plugins', 'cache', 'local', id),
  });

  const manifestParser = new PluginManifestParser(nodeFsAdapter);
  const marketplaceParser = new MarketplaceParser(nodeFsAdapter);

  const pluginInstaller = new PluginInstaller({ cache: pluginCache, settings: claudeSettingsFile });

  const pluginAuthor = new PluginAuthorService({
    cache: pluginCache,
    installer: pluginInstaller,
    parser: manifestParser,
  });

  const octokitClient = new OctokitClient(async () => credentialStore.get('github.pat'));

  const pluginPublisher = new PluginPublisher({
    cache: pluginCache,
    git: gitClient,
    githubApi: octokitClient,
    credentials: credentialStore,
    parser: manifestParser,
    clock,
  });

  const pluginService = new PluginService({
    installer: pluginInstaller,
    author: pluginAuthor,
    publisher: pluginPublisher,
    git: gitClient,
    cache: pluginCache,
    settings: claudeSettingsFile,
    parser: manifestParser,
    marketplaceParser,
  });

  const pluginProvenance = new PluginProvenanceService({
    cache: pluginCache,
    fs: nodeFsAdapter,
  });
  const skillService = new SkillService(customizationService, {
    provenance: pluginProvenance,
    cache: pluginCache,
    fs: nodeFsAdapter,
  });
  const agentService = new AgentService(customizationService, {
    provenance: pluginProvenance,
    cache: pluginCache,
    fs: nodeFsAdapter,
  });
  const commandService = new CommandService(customizationService, {
    provenance: pluginProvenance,
    cache: pluginCache,
    fs: nodeFsAdapter,
  });
  const hookService = new HookService(claudeSettingsFile, {
    cache: pluginCache,
    fs: nodeFsAdapter,
  });
  const globalInstructionService = new GlobalInstructionService(customizationService);
  const marketplacesCacheRoot = (scope: 'personal' | 'project'): string =>
    scope === 'personal'
      ? join(workspacePath, 'marketplaces-cache')
      : join(process.cwd(), '.superset-ai-app', 'marketplaces-cache');
  const marketplaceService = new MarketplaceService({
    repository: new SettingsMarketplaceRepository(claudeSettingsFile),
    parser: marketplaceParser,
    git: gitClient,
    cacheDirRoot: marketplacesCacheRoot,
  });

  await new MarketplaceSeeder({ marketplaceService }).seedDefaultsIfMissing('personal');

  const claudeRuntimeReader = new FsClaudeRuntimeReader({
    claudeJsonPath: join(homedir(), '.claude.json'),
    authCachePath: join(homedir(), '.claude', 'mcp-needs-auth-cache.json'),
    mcpLogsBaseDir: join(homedir(), 'Library', 'Caches', 'claude-cli-nodejs'),
  });

  const healthCollectors: HealthCollector[] = [
    new McpAuthCollector(claudeRuntimeReader, clock),
    new McpRuntimeCollector(claudeRuntimeReader, clock),
    new ConfigDriftCollector(pluginService, clock),
    new SymlinkCollector(adapterManager, symlinkManager, clock),
  ];
  const healthService = new HealthService(healthCollectors, clock);
  const notificationPort = new ElectronNotificationAdapter();

  const handlers = buildHandlers({
    settingsService,
    repoService,
    adapterManager,
    dialogPort,
    pluginService,
    credentialStore,
    skillService,
    agentService,
    commandService,
    hookService,
    globalInstructionService,
    marketplaceService,
    healthService,
    notificationPort,
    appQuit: () => app.quit(),
  });
  const dispatch = createDispatcher(handlers);

  ipcMain.handle(IPC_CHANNEL, async (_event, payload: unknown) => {
    if (!isCallPayload(payload)) {
      return {
        ok: false,
        error: { kind: 'validation', message: 'Invalid IPC payload' },
      };
    }
    return dispatch(payload.method, payload.params);
  });
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1024,
    height: 768,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.on('ready-to-show', () => window.show());

  const devServerUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devServerUrl) {
    void window.loadURL(devServerUrl);
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

void app.whenReady().then(async () => {
  await wireIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
