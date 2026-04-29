import { join } from 'node:path';
import type { Artifact, SyncResult, SyncResultDetails } from '../../../shared/artifact.js';
import type { SettingsService } from './settings-service.js';
import type { ArtifactRepository } from '../ports/artifact-repository.js';
import type { Adapter } from '../ports/adapter.js';
import type { SymlinkManager } from './symlink-manager.js';
import { DomainError } from '../../domain/errors.js';

export interface AdapterManagerDeps {
  settingsService: SettingsService;
  artifactRepository: ArtifactRepository;
  symlinkManager: SymlinkManager;
  adapters: Map<string, Adapter>;
}

export interface SyncOneCommand {
  artifact: Artifact;
}

export interface SyncAllCommand {
  adapterId?: string;
}

export interface RemoveAllCommand {
  adapterId: string;
}

export interface RemoveOneCommand {
  artifact: Artifact;
}

export class AdapterManager {
  constructor(private readonly deps: AdapterManagerDeps) {}

  async syncOne(command: SyncOneCommand): Promise<SyncResult[]> {
    const settings = (await this.deps.settingsService.load()) ?? this.deps.settingsService.getDefaults();
    const enabledAdapters = this.enabledAdapters(settings);
    const results: SyncResult[] = [];

    const source = this.artifactSourcePath(command.artifact, settings.workspacePath);
    const includesProject = command.artifact.frontmatter.scopes.includes('project');
    for (const adapter of enabledAdapters) {
      const destinations = adapter.resolveDestinations({
        artifact: command.artifact,
        linkedRepos: settings.linkedRepos,
      });

      for (const destination of destinations) {
        results.push(
          await this.syncDestination(adapter.adapterId, source, destination.destination),
        );
      }

      if (includesProject && settings.linkedRepos.length === 0) {
        results.push({
          adapter: adapter.adapterId,
          destination: null,
          status: 'ok',
          details: { skipped: 'no-linked-repos' },
        });
      }
    }

    return results;
  }

  async syncAll(command: SyncAllCommand): Promise<SyncResult[]> {
    const settings = (await this.deps.settingsService.load()) ?? this.deps.settingsService.getDefaults();
    const enabledAdapters = this.enabledAdapters(settings).filter((adapter) =>
      command.adapterId ? adapter.adapterId === command.adapterId : true,
    );

    const artifacts = await this.deps.artifactRepository.list();
    const results: SyncResult[] = [];
    for (const artifact of artifacts) {
      const includesProject = artifact.frontmatter.scopes.includes('project');
      for (const adapter of enabledAdapters) {
        const destinations = adapter.resolveDestinations({
          artifact,
          linkedRepos: settings.linkedRepos,
        });

        for (const destination of destinations) {
          results.push(
            await this.syncDestination(adapter.adapterId, this.artifactSourcePath(artifact, settings.workspacePath), destination.destination),
          );
        }

        if (includesProject && settings.linkedRepos.length === 0) {
          results.push({
            adapter: adapter.adapterId,
            destination: null,
            status: 'ok',
            details: { skipped: 'no-linked-repos' },
          });
        }
      }
    }
    return results;
  }

  async removeOne(command: RemoveOneCommand): Promise<SyncResult[]> {
    const settings = (await this.deps.settingsService.load()) ?? this.deps.settingsService.getDefaults();
    const results: SyncResult[] = [];

    for (const adapter of this.deps.adapters.values()) {
      const destinations = adapter.resolveDestinations({
        artifact: command.artifact,
        linkedRepos: settings.linkedRepos,
      });
      for (const destination of destinations) {
        results.push(await this.removeDestination(adapter.adapterId, destination.destination));
      }
    }
    return results;
  }

  async removeAll(command: RemoveAllCommand): Promise<SyncResult[]> {
    const adapter = this.deps.adapters.get(command.adapterId);
    if (!adapter) return [];

    const settings = (await this.deps.settingsService.load()) ?? this.deps.settingsService.getDefaults();
    const artifacts = await this.deps.artifactRepository.list();
    const results: SyncResult[] = [];

    for (const artifact of artifacts) {
      const destinations = adapter.resolveDestinations({
        artifact,
        linkedRepos: settings.linkedRepos,
      });
      for (const destination of destinations) {
        results.push(await this.removeDestination(adapter.adapterId, destination.destination));
      }
    }
    return results;
  }

  private async removeDestination(adapterId: string, destination: string): Promise<SyncResult> {
    try {
      const result = await this.deps.symlinkManager.removeIfExists({ destination });
      const payload: SyncResult = {
        adapter: adapterId,
        destination,
        status: 'ok',
      };
      if (!result.removed) {
        payload.details = { skipped: 'not-found' };
      }
      return payload;
    } catch (err) {
      if (err instanceof DomainError) {
        const payload: SyncResult = {
          adapter: adapterId,
          destination,
          status: 'error',
          message: err.message,
        };
        if (err.details !== undefined) {
          payload.details = err.details as SyncResultDetails;
        }
        return payload;
      }
      return {
        adapter: adapterId,
        destination,
        status: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  private enabledAdapters(settings: NonNullable<Awaited<ReturnType<SettingsService['load']>>>): Adapter[] {
    const adapters: Adapter[] = [];
    for (const adapter of this.deps.adapters.values()) {
      const adapterConfig = (settings.adapters as Record<string, { enabled: boolean }>)[adapter.adapterId];
      if (adapterConfig?.enabled) {
        adapters.push(adapter);
      }
    }
    return adapters;
  }

  private artifactSourcePath(artifact: Artifact, workspacePath: string): string {
    const name = artifact.frontmatter.name;
    const type = artifact.frontmatter.type;
    if (type === 'skill') {
      return join(workspacePath, 'skills', name);
    }
    const folder =
      type === 'reference'
        ? 'references'
        : type === 'agent'
          ? 'agents'
          : type === 'global-instruction'
            ? 'global-instructions'
            : 'agents';
    return join(workspacePath, folder, `${name}.md`);
  }

  private async syncDestination(
    adapterId: string,
    source: string,
    destination: string,
  ): Promise<SyncResult> {
    try {
      const result = await this.deps.symlinkManager.create({ source, destination });
      const payload: SyncResult = {
        adapter: adapterId,
        destination,
        status: result.status,
      };
      if (result.status === 'conflict') {
        payload.message = 'Overwrote existing destination and created a backup';
      }
      if (result.details !== undefined) {
        payload.details = result.details;
      }
      return payload;
    } catch (err) {
      if (err instanceof DomainError && err.kind === 'symlink_conflict') {
        return {
          adapter: adapterId,
          destination,
          status: 'conflict',
          message: err.message,
          details: err.details as SyncResultDetails,
        };
      }
      if (err instanceof DomainError) {
        const payload: SyncResult = {
          adapter: adapterId,
          destination,
          status: 'error',
          message: err.message,
        };
        if (err.details !== undefined) {
          payload.details = err.details as SyncResultDetails;
        }
        return payload;
      }
      return {
        adapter: adapterId,
        destination,
        status: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }
}
