import { randomUUID } from 'node:crypto';
import { basename } from 'node:path';
import type { SettingsService } from '../application/services/settings-service.js';
import type { RepoService } from '../application/services/repo-service.js';
import type { WorkspaceBootstrapService } from '../application/services/workspace-bootstrap.js';
import type { WorkspaceLocator } from '../application/services/workspace-locator.js';
import type { ArtifactService } from '../application/services/artifact-service.js';
import type { TemplateService } from '../application/services/template-service.js';
import type { AdapterManager } from '../application/services/adapter-manager.js';
import type { SearchService, SearchOptions } from '../application/services/search-service.js';
import type { DialogPort, SelectFolderParams } from '../application/ports/dialog-port.js';
import type { EnvironmentPort } from '../application/ports/environment-port.js';
import type { PathProber } from '../application/ports/path-prober.js';
import { DomainError } from '../domain/errors.js';
import { getDefaults, type LinkedRepo, type LinkedRepoView, type Settings } from '../../shared/settings.js';
import type { ArtifactListParams } from '../../shared/ipc-contract.js';
import type { Artifact, ArtifactType } from '../../shared/artifact.js';
import type { Template, TemplateTargetType } from '../../shared/template.js';
import type { IpcHandlers } from './dispatcher.js';

export interface IpcDeps {
  settingsService: SettingsService;
  repoService: RepoService;
  workspaceBootstrap: WorkspaceBootstrapService;
  artifactService: ArtifactService;
  templateService: TemplateService;
  adapterManager: AdapterManager;
  searchService: SearchService;
  dialogPort: DialogPort;
  pathProber: PathProber;
  environmentPort: EnvironmentPort;
  workspaceLocator?: WorkspaceLocator;
}

const ARTIFACT_TYPES: readonly ArtifactType[] = [
  'skill',
  'reference',
  'agent',
  'global-instruction',
];

const TEMPLATE_TARGET_TYPES: readonly TemplateTargetType[] = [
  'skill',
  'reference',
  'agent',
  'global-instruction',
];

const asTemplateTargetType = (value: unknown, field: string): TemplateTargetType => {
  if (typeof value !== 'string' || !(TEMPLATE_TARGET_TYPES as readonly string[]).includes(value)) {
    throw new DomainError(
      'validation',
      `Invalid '${field}' (must be ${TEMPLATE_TARGET_TYPES.join(' | ')})`,
    );
  }
  return value as TemplateTargetType;
};

const asArtifact = (value: unknown): Artifact => {
  if (typeof value !== 'object' || value === null) {
    throw new DomainError('validation', `Invalid 'artifact' payload`);
  }
  return value as Artifact;
};

const asTemplate = (value: unknown): Template => {
  if (typeof value !== 'object' || value === null) {
    throw new DomainError('validation', `Invalid 'template' payload`);
  }
  return value as Template;
};

const asArtifactType = (value: unknown, field: string): ArtifactType => {
  if (typeof value !== 'string' || !(ARTIFACT_TYPES as readonly string[]).includes(value)) {
    throw new DomainError(
      'validation',
      `Invalid '${field}' (must be ${ARTIFACT_TYPES.join(' | ')})`,
    );
  }
  return value as ArtifactType;
};

const asBoolean = (value: unknown, field: string): boolean => {
  if (typeof value !== 'boolean') {
    throw new DomainError('validation', `Missing or invalid '${field}'`);
  }
  return value;
};

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

interface WorkspaceBootstrapParams {
  workspacePath: string;
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
    workspaceBootstrap,
    artifactService,
    templateService,
    adapterManager,
    searchService,
    dialogPort,
    pathProber,
    environmentPort,
    workspaceLocator,
  } = deps;

  return {
    'app.getHomeDir': () => environmentPort.getHomeDir(),

    'settings.get': () => settingsService.load(),

    'settings.save': async (params) => {
      await settingsService.save(params as Settings);
    },

    'settings.merge': (params) =>
      settingsService.merge(params as Parameters<SettingsService['merge']>[0]),

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

    'workspace.bootstrap': async (params) => {
      const { workspacePath } = params as WorkspaceBootstrapParams;
      await workspaceBootstrap.create(asString(workspacePath, 'workspacePath'));
    },

    'workspace.exists': (params) => {
      const { path } = params as RepoPathParams;
      return pathProber.exists(asString(path, 'path'));
    },

    'workspace.getActive': async (): Promise<string> => {
      if (!workspaceLocator) {
        throw new DomainError('internal', 'workspaceLocator not wired');
      }
      return workspaceLocator.resolve();
    },

    'workspace.setActive': async (params) => {
      if (!workspaceLocator) {
        throw new DomainError('internal', 'workspaceLocator not wired');
      }
      const { workspacePath } = params as WorkspaceBootstrapParams;
      await workspaceLocator.setActive(asString(workspacePath, 'workspacePath'));
    },

    'dialog.selectFolder': (params) => {
      const raw = params === undefined || params === null ? {} : asObject(params, 'dialog.selectFolder');
      const dialogParams: SelectFolderParams = {};
      if (typeof raw['defaultPath'] === 'string') {
        dialogParams.defaultPath = raw['defaultPath'];
      }
      return dialogPort.selectFolder(dialogParams);
    },

    'artifact.list': async (params) => {
      const raw =
        params === undefined || params === null ? {} : asObject(params, 'artifact.list');
      const query: ArtifactListParams = {};
      if (raw['type'] !== undefined) {
        query.type = asArtifactType(raw['type'], 'type');
      }
      return artifactService.list(query);
    },

    'artifact.get': async (params) => {
      const raw = asObject(params, 'artifact.get');
      return artifactService.get({ id: asString(raw['id'], 'id') });
    },

    'artifact.save': async (params) => {
      const raw = asObject(params, 'artifact.save');
      const artifact = asArtifact(raw['artifact']);
      const isCreate = raw['isCreate'];
      return artifactService.save({
        artifact,
        ...(typeof isCreate === 'boolean' ? { isCreate } : {}),
      });
    },

    'artifact.delete': async (params) => {
      const raw = asObject(params, 'artifact.delete');
      return artifactService.delete({
        id: asString(raw['id'], 'id'),
        removeSymlinks: asBoolean(raw['removeSymlinks'], 'removeSymlinks'),
      });
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

    'template.list': async (params) => {
      const raw = params === undefined || params === null ? {} : asObject(params, 'template.list');
      const query: { targetType?: TemplateTargetType } = {};
      if (raw['targetType'] !== undefined) {
        query.targetType = asTemplateTargetType(raw['targetType'], 'targetType');
      }
      return templateService.list(query);
    },

    'template.get': async (params) => {
      const raw = asObject(params, 'template.get');
      return templateService.get({ id: asString(raw['id'], 'id') });
    },

    'template.save': async (params) => {
      const raw = asObject(params, 'template.save');
      const template = asTemplate(raw['template']);
      const isCreate = raw['isCreate'];
      return templateService.save({
        template,
        ...(typeof isCreate === 'boolean' ? { isCreate } : {}),
      });
    },

    'template.delete': async (params) => {
      const raw = asObject(params, 'template.delete');
      await templateService.delete({ id: asString(raw['id'], 'id') });
      return { ok: true };
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

    'artifact.search': async (params) => {
      const raw = params === undefined || params === null ? {} : asObject(params, 'artifact.search');
      const query = asString(raw['query'], 'query');
      let options: SearchOptions | undefined;
      if (raw['options'] !== undefined) {
        options = raw['options'] as SearchOptions;
      }
      return searchService.search(query, options);
    },
  };
}
