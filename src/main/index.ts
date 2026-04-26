import { app, BrowserWindow, ipcMain } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { IPC_CHANNEL } from '../shared/ipc-contract.js';
import { SettingsService } from './application/services/settings-service.js';
import { RepoService } from './application/services/repo-service.js';
import { WorkspaceBootstrapService } from './application/services/workspace-bootstrap.js';
import { FsSettingsRepository } from './infrastructure/settings/fs-settings-repository.js';
import { FsRepoReader } from './infrastructure/repo/fs-repo-reader.js';
import { FsWorkspaceBootstrap } from './infrastructure/workspace/fs-workspace-bootstrap.js';
import { ElectronDialogAdapter } from './infrastructure/dialog/electron-dialog-adapter.js';
import { ElectronEnvironmentAdapter } from './infrastructure/environment/electron-environment-adapter.js';
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

function wireIpc(): void {
  const settingsService = new SettingsService(
    new FsSettingsRepository(join(app.getPath('userData'), 'settings.json')),
  );
  const repoReader = new FsRepoReader();
  const repoService = new RepoService(repoReader);
  const workspaceBootstrap = new WorkspaceBootstrapService(new FsWorkspaceBootstrap());
  const dialogPort = new ElectronDialogAdapter();
  const environmentPort = new ElectronEnvironmentAdapter();
  const handlers = buildHandlers({
    settingsService,
    repoService,
    workspaceBootstrap,
    dialogPort,
    pathProber: repoReader,
    environmentPort,
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

void app.whenReady().then(() => {
  wireIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
