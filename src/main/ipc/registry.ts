import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import type { SettingsService } from '../application/services/settings-service.js';
import type { RepoService } from '../application/services/repo-service.js';
import type { AdapterManager } from '../application/services/adapter-manager.js';
import type { DialogPort, SelectFolderParams } from '../application/ports/dialog-port.js';
import type { PluginService } from '../application/services/plugin-service.js';
import type { SkillService } from '../application/services/skill-service.js';
import type { AgentService } from '../application/services/agent-service.js';
import type { ReferenceService } from '../application/services/reference-service.js';
import type { GlobalInstructionService } from '../application/services/global-instruction-service.js';
import type { CommandService } from '../application/services/command-service.js';
import type { HookService } from '../application/services/hook-service.js';
import type { MarketplaceService } from '../application/services/marketplace-service.js';
import type { CredentialStorePort } from '../application/ports/credential-store-port.js';
import { DomainError } from '../domain/errors.js';
import { getDefaults, type LinkedRepo, type LinkedRepoView, type Settings } from '../../shared/settings.js';
import type { IpcHandlers } from './dispatcher.js';
import { buildPluginHandlers } from './plugin-handlers.js';
import { buildCredentialsHandlers } from './credentials-handlers.js';
import { buildSkillHandlers } from './skill-handlers.js';
import { buildAgentHandlers } from './agent-handlers.js';
import { buildCommandHandlers } from './command-handlers.js';
import { buildHookHandlers } from './hook-handlers.js';
import { buildReferenceHandlers } from './reference-handlers.js';
import { buildGlobalInstructionHandlers } from './global-instruction-handlers.js';
import { buildMarketplaceHandlers } from './marketplace-handlers.js';
import { updateLanguageSection } from '../application/services/language-section.js';
import { asLanguagePreference } from './_validators.js';
import { globalInstructionId } from '../domain/global-instruction-id.js';

export interface IpcDeps {
  settingsService: SettingsService;
  repoService: RepoService;
  adapterManager: AdapterManager;
  dialogPort: DialogPort;
  pluginService: PluginService;
  credentialStore: CredentialStorePort;
  skillService: SkillService;
  agentService: AgentService;
  commandService: CommandService;
  hookService: HookService;
  referenceService: ReferenceService;
  globalInstructionService: GlobalInstructionService;
  marketplaceService: MarketplaceService;
  appQuit: () => void;
}

interface RepoLinkParams {
  path: string;
  name?: string;
}

interface RepoUnlinkParams {
  id: string;
}

interface RepoPathParams {
  path: string;
}

const asString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new DomainError('validation', `Missing or invalid '${field}'`);
  }
  return value;
};

const asObject = (value: unknown, label: string): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new DomainError('validation', `Invalid '${label}' payload`);
  }
  return value as Record<string, unknown>;
};

export function buildHandlers(deps: IpcDeps): IpcHandlers {
  const {
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
    referenceService,
    globalInstructionService,
    marketplaceService,
    appQuit,
  } = deps;

  return {
    'settings.get': () => settingsService.load(),

    'settings.save': async (params) => {
      await settingsService.save(params as Settings);
    },

    'settings.merge': (params) =>
      settingsService.merge(params as Parameters<SettingsService['merge']>[0]),

    'settings.setLanguage': async (params) => {
      const raw = asObject(params, 'settings.setLanguage');
      const language = asLanguagePreference(raw['language'], 'language');

      const settings = await settingsService.merge({ language });

      const gi = await globalInstructionService.get(globalInstructionId('default'));
      const newBody = updateLanguageSection(gi.body, language);
      const { syncReport } = await globalInstructionService.save({
        globalInstruction: { ...gi, body: newBody },
      });

      return { settings, syncReport };
    },

    'repo.detectGit': (params) => {
      const { path } = params as RepoPathParams;
      return repoService.detectGit(asString(path, 'path'));
    },

    'repo.getCurrentBranch': (params) => {
      const { path } = params as RepoPathParams;
      return repoService.getCurrentBranch(asString(path, 'path'));
    },

    'repo.link': async (params): Promise<LinkedRepoView> => {
      const { path, name } = params as RepoLinkParams;
      const repoPath = asString(path, 'path');

      const isGit = await repoService.detectGit(repoPath);
      if (!isGit) {
        throw new DomainError('validation', `Not a git repository: ${repoPath}`, {
          path: repoPath,
        });
      }

      const current = (await settingsService.load()) ?? getDefaults();
      const existing = current.linkedRepos.find((repo) => repo.path === repoPath);

      const entry: LinkedRepo = existing ?? {
        id: randomUUID(),
        name: name ?? basename(repoPath),
        path: repoPath,
      };

      const nextRepos = existing
        ? current.linkedRepos
        : [...current.linkedRepos, entry];
      await settingsService.merge({ linkedRepos: nextRepos });

      const branch = await repoService.getCurrentBranch(repoPath);
      return { id: entry.id, name: entry.name, path: entry.path, branch };
    },

    'repo.unlink': async (params) => {
      const { id } = params as RepoUnlinkParams;
      const repoId = asString(id, 'id');
      const current = (await settingsService.load()) ?? getDefaults();
      await settingsService.merge({
        linkedRepos: current.linkedRepos.filter((repo) => repo.id !== repoId),
      });
    },

    'repo.list': async (): Promise<LinkedRepoView[]> => {
      const current = (await settingsService.load()) ?? getDefaults();
      const views: LinkedRepoView[] = [];
      for (const repo of current.linkedRepos) {
        const branch = await repoService.getCurrentBranch(repo.path);
        views.push({ id: repo.id, name: repo.name, path: repo.path, branch });
      }
      return views;
    },

    'dialog.selectFolder': (params) => {
      const raw = params === undefined || params === null ? {} : asObject(params, 'dialog.selectFolder');
      const dialogParams: SelectFolderParams = {};
      if (typeof raw['defaultPath'] === 'string') {
        dialogParams.defaultPath = raw['defaultPath'];
      }
      return dialogPort.selectFolder(dialogParams);
    },

    'adapter.syncAll': async (params) => {
      const raw = params === undefined || params === null ? {} : asObject(params, 'adapter.syncAll');
      const adapterId = raw['adapterId'];
      if (adapterId !== undefined && typeof adapterId !== 'string') {
        throw new DomainError('validation', `Invalid 'adapterId'`);
      }
      return adapterManager.syncAll({
        ...(typeof adapterId === 'string' ? { adapterId } : {}),
      });
    },

    'adapter.removeAll': async (params) => {
      const raw = asObject(params, 'adapter.removeAll');
      return adapterManager.removeAll({
        adapterId: asString(raw['adapterId'], 'adapterId'),
      });
    },

    'adapter.setEnabled': async (params) => {
      const raw = asObject(params, 'adapter.setEnabled');
      const adapterId = asString(raw['adapterId'], 'adapterId');
      if (typeof raw['enabled'] !== 'boolean') {
        throw new DomainError('validation', "Missing or invalid 'enabled'");
      }
      const enabled = raw['enabled'];
      const removeSymlinks = raw['removeSymlinks'] !== false;
      const runSyncAll = raw['runSyncAll'] !== false;

      if (!enabled) {
        const removeResult = removeSymlinks
          ? await adapterManager.removeAdapterSymlinks(adapterId)
          : { removed: 0, skipped: 0, errors: [] };
        await settingsService.merge({ adapters: { [adapterId]: { enabled: false } } });
        return removeResult;
      } else {
        await settingsService.merge({ adapters: { [adapterId]: { enabled: true } } });
        const syncReport = runSyncAll
          ? await adapterManager.syncAll({ adapterId })
          : [];
        return { syncReport };
      }
    },

    'adapter.countDestinations': async (params) => {
      const raw = asObject(params, 'adapter.countDestinations');
      const adapterId = asString(raw['adapterId'], 'adapterId');
      const count = await adapterManager.countDestinations(adapterId);
      return { count };
    },

    'app.restore': async () => {
      await rm(join(homedir(), '.superset-ai-app'), { recursive: true, force: true });
      await rm(join(homedir(), '.claude'), { recursive: true, force: true });
      await rm(join(process.cwd(), '.env.local'), { force: true });
      appQuit();
    },

    ...buildPluginHandlers(pluginService),
    ...buildCredentialsHandlers(credentialStore),
    ...buildSkillHandlers(skillService),
    ...buildAgentHandlers(agentService),
    ...buildCommandHandlers(commandService),
    ...buildHookHandlers(hookService),
    ...buildReferenceHandlers(referenceService),
    ...buildGlobalInstructionHandlers(globalInstructionService),
    ...buildMarketplaceHandlers(marketplaceService),
  };
}
