import { app, BrowserWindow, ipcMain } from 'electron';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { IPC_CHANNEL } from '../shared/ipc-contract.js';
import { SettingsService } from './application/services/settings-service.js';
import { RepoService } from './application/services/repo-service.js';
import { WorkspaceBootstrapService } from './application/services/workspace-bootstrap.js';
import { CustomizationService } from './application/services/customization-service.js';
import { TemplateService } from './application/services/template-service.js';
import { AdapterManager } from './application/services/adapter-manager.js';
import { SymlinkManager } from './application/services/symlink-manager.js';
import { FsSettingsRepository } from './infrastructure/settings/fs-settings-repository.js';
import { FsRepoReader } from './infrastructure/repo/fs-repo-reader.js';
import { FsWorkspaceBootstrap } from './infrastructure/workspace/fs-workspace-bootstrap.js';
import { FsCustomizationRepository } from './infrastructure/customization/fs-customization-repository.js';
import { FsTemplateRepository } from './infrastructure/template/fs-template-repository.js';
import { TemplateSeeder } from './application/services/template-seeder.js';
import { SystemClock } from './infrastructure/clock/system-clock.js';
import { ElectronDialogAdapter } from './infrastructure/dialog/electron-dialog-adapter.js';
import { NodeFsAdapter } from './infrastructure/filesystem/node-fs-adapter.js';
import { ClaudeAdapter } from './infrastructure/adapters/claude-adapter.js';
import { CopilotAdapter } from './infrastructure/adapters/copilot-adapter.js';
import { CopilotInstructionsGen } from './application/services/copilot-instructions-gen.js';
import { SchemaValidator } from './application/services/schema-validator.js';
import { SearchService } from './application/services/search-service.js';
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
  const workspacePath = join(homedir(), '.sde-ai-app');

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
  const copilotInstructionsGen = new CopilotInstructionsGen({
    customizationRepository: customizationRepo,
    workspaceFs: nodeFsAdapter,
    workspacePath,
  });
  const copilotAdapter = new CopilotAdapter({
    homedir: homedir(),
    workspacePath,
    copilotInstructionsGen,
  });
  const adapterManager = new AdapterManager({
    settingsService,
    customizationRepository: customizationRepo,
    symlinkManager,
    workspacePath,
    adapters: new Map<string, Adapter>([
      [claudeAdapter.adapterId, claudeAdapter],
      [copilotAdapter.adapterId, copilotAdapter],
    ]),
  });
  const schemaValidator = new SchemaValidator();
  const customizationService = new CustomizationService(customizationRepo, clock, adapterManager, schemaValidator);
  const searchService = new SearchService({ customizationRepository: customizationRepo });
  const templatesSeedDir = join(process.cwd(), 'src', 'main', 'templates');
  await new TemplateSeeder({ sourceDir: templatesSeedDir }).seedIfMissing(workspacePath);
  const templateRepo = new FsTemplateRepository(workspacePath);
  const templateService = new TemplateService(templateRepo, clock, schemaValidator);

  const credentialStore: CredentialStorePort = new SafeStorageCredentials(app.getPath('userData'));

  // T10.1: wire full PluginService
  const gitClient = new SimpleGitClient();

  const pluginsWorkspaceDir = join(workspacePath, 'plugins');
  const pluginCache = new PluginCacheFile({
    pluginsDir: (scope) =>
      scope === 'personal'
        ? pluginsWorkspaceDir
        : join(process.cwd(), '.sde-ai-app', 'plugins'),
    cacheDir: (scope) =>
      scope === 'personal'
        ? join(homedir(), '.claude', 'plugins', 'cache', 'skillforge-imports')
        : join(process.cwd(), '.claude', 'plugins', 'cache', 'skillforge-imports'),
  });

  const claudeSettingsFile = new ClaudeSettingsFile({
    settingsPath: (scope) =>
      scope === 'personal'
        ? join(homedir(), '.claude', 'settings.json')
        : join(process.cwd(), '.claude', 'settings.json'),
    symlinkPath: (scope, id) =>
      scope === 'personal'
        ? join(homedir(), '.claude', 'plugins', 'cache', 'skillforge-imports', id)
        : join(process.cwd(), '.claude', 'plugins', 'cache', 'skillforge-imports', id),
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

  const handlers = buildHandlers({
    settingsService,
    repoService,
    customizationService,
    templateService,
    adapterManager,
    searchService,
    dialogPort,
    pluginService,
    credentialStore,
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
