import { randomUUID } from 'node:crypto';
import { basename } from 'node:path';
import type { SettingsService } from '../application/services/settings-service.js';
import type { RepoService } from '../application/services/repo-service.js';
import type { WorkspaceBootstrapService } from '../application/services/workspace-bootstrap.js';
import type { ArtifactService } from '../application/services/artifact-service.js';
import type { TemplateService } from '../application/services/template-service.js';
import type { AdapterManager } from '../application/services/adapter-manager.js';
import type { DialogPort, SelectFolderParams } from '../application/ports/dialog-port.js';
import type { EnvironmentPort } from '../application/ports/environment-port.js';
import type { PathProber } from '../application/ports/path-prober.js';
import { DomainError } from '../domain/errors.js';
import { getDefaults, type LinkedRepo, type LinkedRepoView, type Settings } from '../../shared/settings.js';
import type { ArtifactListParams } from '../../shared/ipc-contract.js';
import type { Artifact, ArtifactType } from '../../shared/artifact.js';
import type { IpcHandlers } from './dispatcher.js';

export interface IpcDeps {
  settingsService: SettingsService;
  repoService: RepoService;
  workspaceBootstrap: WorkspaceBootstrapService;
  artifactService: ArtifactService;
  templateService: TemplateService;
  adapterManager: AdapterManager;
  dialogPort: DialogPort;
  pathProber: PathProber;
  environmentPort: EnvironmentPort;
}

const ARTIFACT_TYPES: readonly ArtifactType[] = ['skill', 'reference', 'agent'];

const asArtifact = (value: unknown): Artifact => {
  if (typeof value !== 'object' || value === null) {
    throw new DomainError('validation', `Invalid 'artifact' payload`);
  }
  return value as Artifact;
};

const asArtifactType = (value: unknown, field: string): ArtifactType => {
  if (typeof value !== 'string' || !(ARTIFACT_TYPES as readonly string[]).includes(value)) {
    throw new DomainError('validation', `Invalid '${field}' (must be skill | reference | agent)`);
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
    dialogPort,
    pathProber,
    environmentPort,
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

    'template.list': async (params) => {
      const raw = asObject(params, 'template.list');
      return templateService.list({ type: asArtifactType(raw['type'], 'type') });
    },
  };
}
