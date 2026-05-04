import { app, BrowserWindow, ipcMain } from 'electron';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { promises as fs } from 'node:fs';
import { IPC_CHANNEL } from '../shared/ipc-contract.js';
import { getDefaultWorkspacePath, type Settings } from '../shared/settings.js';
import { SettingsService } from './application/services/settings-service.js';
import { WorkspaceLocator } from './application/services/workspace-locator.js';
import { FsWorkspacePointerRepository } from './infrastructure/workspace/fs-workspace-pointer-repository.js';
import { RepoService } from './application/services/repo-service.js';
import { WorkspaceBootstrapService } from './application/services/workspace-bootstrap.js';
import { ArtifactService } from './application/services/artifact-service.js';
import { TemplateService } from './application/services/template-service.js';
import { AdapterManager } from './application/services/adapter-manager.js';
import { SymlinkManager } from './application/services/symlink-manager.js';
import { FsSettingsRepository } from './infrastructure/settings/fs-settings-repository.js';
import { FsRepoReader } from './infrastructure/repo/fs-repo-reader.js';
import { FsWorkspaceBootstrap } from './infrastructure/workspace/fs-workspace-bootstrap.js';
import { FsArtifactRepository } from './infrastructure/artifact/fs-artifact-repository.js';
import { BuiltInTemplateRepository } from './infrastructure/template/built-in-template-repository.js';
import { SystemClock } from './infrastructure/clock/system-clock.js';
import { ElectronDialogAdapter } from './infrastructure/dialog/electron-dialog-adapter.js';
import { ElectronEnvironmentAdapter } from './infrastructure/environment/electron-environment-adapter.js';
import { NodeFsAdapter } from './infrastructure/filesystem/node-fs-adapter.js';
import { ClaudeAdapter } from './infrastructure/adapters/claude-adapter.js';
import { CopilotAdapter } from './infrastructure/adapters/copilot-adapter.js';
import { CopilotInstructionsGen } from './application/services/copilot-instructions-gen.js';
import { SchemaValidator } from './application/services/schema-validator.js';
import { SearchService } from './application/services/search-service.js';
import type { Adapter } from './application/ports/adapter.js';
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

async function migrateLegacySettings(
  legacySettingsPath: string,
  pointerRepo: FsWorkspacePointerRepository,
): Promise<void> {
  let raw: string;
  try {
    raw = await fs.readFile(legacySettingsPath, 'utf8');
  } catch (err) {
    if (typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'ENOENT') {
      return;
    }
    throw err;
  }
  const legacy = JSON.parse(raw) as Partial<Settings>;
  const target = typeof legacy.workspacePath === 'string' && legacy.workspacePath.length > 0
    ? legacy.workspacePath
    : getDefaultWorkspacePath(homedir());
  await fs.mkdir(target, { recursive: true });
  await fs.writeFile(join(target, 'settings.json'), raw, 'utf8');
  await pointerRepo.save(target);
  await fs.unlink(legacySettingsPath).catch(() => undefined);
}

async function wireIpc(): Promise<void> {
  const userDataDir = app.getPath('userData');
  const pointerRepo = new FsWorkspacePointerRepository(join(userDataDir, 'workspace.json'));
  await migrateLegacySettings(join(userDataDir, 'settings.json'), pointerRepo);

  const defaultWorkspacePath = getDefaultWorkspacePath(homedir());
  const workspaceLocator = new WorkspaceLocator({
    pointerRepo,
    envValue: () => process.env['SDE_AI_APP_WORKSPACE'],
    defaultPath: defaultWorkspacePath,
  });

  const settingsService = new SettingsService(
    new FsSettingsRepository(async () =>
      join(await workspaceLocator.resolve(), 'settings.json'),
    ),
  );
  const repoReader = new FsRepoReader();
  const repoService = new RepoService(repoReader);
  const workspaceBootstrap = new WorkspaceBootstrapService(new FsWorkspaceBootstrap());
  const dialogPort = new ElectronDialogAdapter();
  const environmentPort = new ElectronEnvironmentAdapter();

  const clock = new SystemClock();
  const artifactRepo = new FsArtifactRepository(async () => workspaceLocator.resolve());

  const activeWorkspacePath = await workspaceLocator.resolve();
  const symlinkManager = new SymlinkManager(new NodeFsAdapter(), clock, activeWorkspacePath);
  const nodeFsAdapter = new NodeFsAdapter();
  const claudeAdapter = new ClaudeAdapter({ homedir: homedir() });
  const copilotInstructionsGen = new CopilotInstructionsGen({
    artifactRepository: artifactRepo,
    workspaceFs: nodeFsAdapter,
    workspacePath: activeWorkspacePath,
  });
  const copilotAdapter = new CopilotAdapter({
    homedir: homedir(),
    workspacePath: activeWorkspacePath,
    copilotInstructionsGen,
  });
  const adapterManager = new AdapterManager({
    settingsService,
    artifactRepository: artifactRepo,
    symlinkManager,
    adapters: new Map<string, Adapter>([
      [claudeAdapter.adapterId, claudeAdapter],
      [copilotAdapter.adapterId, copilotAdapter],
    ]),
  });
  const schemaValidator = new SchemaValidator();
  const artifactService = new ArtifactService(artifactRepo, clock, adapterManager, schemaValidator);
  const searchService = new SearchService({ artifactRepository: artifactRepo });
  const templatesDir = join(process.cwd(), 'src', 'main', 'templates');
  const templateService = new TemplateService(new BuiltInTemplateRepository(templatesDir));

  const handlers = buildHandlers({
    settingsService,
    repoService,
    workspaceBootstrap,
    artifactService,
    templateService,
    adapterManager,
    searchService,
    dialogPort,
    pathProber: repoReader,
    environmentPort,
    workspaceLocator,
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
