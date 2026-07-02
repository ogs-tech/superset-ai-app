import { join } from 'node:path';
import type { Customization, SyncResult, SyncResultDetails } from '../../../shared/customization.js';
import type { Entity } from '../../../shared/entity.js';
import type { SettingsService } from './settings-service.js';
import type { CustomizationRepository } from '../ports/customization-repository.js';
import type { EntityRepository } from '../ports/entity-repository.js';
import type { Adapter } from '../ports/adapter.js';
import type { SymlinkManager } from './symlink-manager.js';
import { DomainError } from '../../domain/errors.js';

export interface SymlinkError {
  destination: string;
  kind: string;
  message: string;
}

export interface RemoveAdapterResult {
  removed: number;
  skipped: number;
  errors: SymlinkError[];
}

export interface AdapterManagerDeps {
  settingsService: SettingsService;
  customizationRepository: CustomizationRepository;
  entityRepository: EntityRepository;
  symlinkManager: SymlinkManager;
  adapters: Map<string, Adapter>;
  workspacePath: string;
}

export interface SymlinkPlanEntry {
  adapterId: string;
  source: string;
  destination: string;
  scope: 'personal' | 'project';
}

export interface SyncOneCommand {
  customization: Customization;
}

export interface SyncAllCommand {
  adapterId?: string;
}

export interface RemoveAllCommand {
  adapterId: string;
}

export interface RemoveOneCommand {
  customization: Customization;
}

export interface SyncEntityCommand {
  entity: Entity;
}

export interface RemoveEntityCommand {
  entity: Entity;
}

export class AdapterManager {
  constructor(private readonly deps: AdapterManagerDeps) {}

  async syncOne(command: SyncOneCommand): Promise<SyncResult[]> {
    const settings = (await this.deps.settingsService.load()) ?? this.deps.settingsService.getDefaults();
    const enabledAdapters = this.enabledAdapters(settings);
    const results: SyncResult[] = [];

    const source = this.customizationSourcePath(command.customization, this.deps.workspacePath);
    const includesProject = command.customization.frontmatter.scopes.includes('project');
    for (const adapter of enabledAdapters) {
      const destinations = await adapter.resolveDestinations({
        customization: command.customization,
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

    const entities = await this.deps.entityRepository.list();
    const results: SyncResult[] = [];
    for (const entity of entities) {
      const includesProject = entity.scopes.includes('project');
      for (const adapter of enabledAdapters) {
        const destinations = await adapter.resolveEntityDestinations({
          entity,
          linkedRepos: settings.linkedRepos,
        });

        for (const destination of destinations) {
          results.push(
            await this.syncDestination(adapter.adapterId, this.entitySourcePath(entity, this.deps.workspacePath), destination.destination),
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
      const destinations = await adapter.resolveDestinations({
        customization: command.customization,
        linkedRepos: settings.linkedRepos,
      });
      for (const destination of destinations) {
        results.push(await this.removeDestination(adapter.adapterId, destination.destination));
      }
    }
    return results;
  }

  async syncEntity(command: SyncEntityCommand): Promise<SyncResult[]> {
    const settings = (await this.deps.settingsService.load()) ?? this.deps.settingsService.getDefaults();
    const enabledAdapters = this.enabledAdapters(settings);
    const results: SyncResult[] = [];

    const source = this.entitySourcePath(command.entity, this.deps.workspacePath);
    const includesProject = command.entity.scopes.includes('project');
    for (const adapter of enabledAdapters) {
      const destinations = await adapter.resolveEntityDestinations({
        entity: command.entity,
        linkedRepos: settings.linkedRepos,
      });
      for (const destination of destinations) {
        results.push(await this.syncDestination(adapter.adapterId, source, destination.destination));
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

  async removeEntity(command: RemoveEntityCommand): Promise<SyncResult[]> {
    const settings = (await this.deps.settingsService.load()) ?? this.deps.settingsService.getDefaults();
    const results: SyncResult[] = [];
    for (const adapter of this.deps.adapters.values()) {
      const destinations = await adapter.resolveEntityDestinations({
        entity: command.entity,
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
    const entities = await this.deps.entityRepository.list();
    const results: SyncResult[] = [];

    for (const entity of entities) {
      const destinations = await adapter.resolveEntityDestinations({
        entity,
        linkedRepos: settings.linkedRepos,
      });
      for (const destination of destinations) {
        results.push(await this.removeDestination(adapter.adapterId, destination.destination));
      }
    }
    return results;
  }

  async removeAdapterSymlinks(adapterId: string): Promise<RemoveAdapterResult> {
    const adapter = this.deps.adapters.get(adapterId);
    if (!adapter) return { removed: 0, skipped: 0, errors: [] };

    const settings = (await this.deps.settingsService.load()) ?? this.deps.settingsService.getDefaults();
    const workspacePath = this.deps.workspacePath;
    const entities = await this.deps.entityRepository.list();
    let removed = 0;
    let skipped = 0;
    const errors: SymlinkError[] = [];

    for (const entity of entities) {
      const destinations = await adapter.resolveEntityDestinations({
        entity,
        linkedRepos: settings.linkedRepos,
      });
      for (const dest of destinations) {
        try {
          const result = await this.deps.symlinkManager.removeIfPointsToWorkspace(dest.destination, workspacePath);
          if (result === 'removed') {
            removed++;
          } else {
            skipped++;
          }
        } catch (err) {
          errors.push({
            destination: dest.destination,
            kind: err instanceof DomainError ? err.kind : 'internal',
            message: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }
    }

    return { removed, skipped, errors };
  }

  /**
   * Removes every app-created symlink (those pointing into the workspace) across
   * all registered adapters, aggregating the per-adapter results. Used by the
   * factory-reset flow — it never touches symlinks pointing elsewhere or real files.
   */
  async removeAllAdapterSymlinks(): Promise<RemoveAdapterResult> {
    const aggregate: RemoveAdapterResult = { removed: 0, skipped: 0, errors: [] };
    for (const adapterId of this.deps.adapters.keys()) {
      const result = await this.removeAdapterSymlinks(adapterId);
      aggregate.removed += result.removed;
      aggregate.skipped += result.skipped;
      aggregate.errors.push(...result.errors);
    }
    return aggregate;
  }

  async countDestinations(adapterId: string): Promise<number> {
    const adapter = this.deps.adapters.get(adapterId);
    if (!adapter) return 0;

    const settings = (await this.deps.settingsService.load()) ?? this.deps.settingsService.getDefaults();
    const workspacePath = this.deps.workspacePath;
    const entities = await this.deps.entityRepository.list();
    let count = 0;

    for (const entity of entities) {
      const destinations = await adapter.resolveEntityDestinations({
        entity,
        linkedRepos: settings.linkedRepos,
      });
      for (const dest of destinations) {
        try {
          const isWorkspaceLink = await this.deps.symlinkManager.isSymlinkToWorkspace(dest.destination, workspacePath);
          if (isWorkspaceLink) count++;
        } catch {
          // skip
        }
      }
    }
    return count;
  }

  /**
   * Read-only resolution of every expected symlink across enabled adapters and
   * all customizations. Mirrors syncAll's resolution but performs NO filesystem
   * writes — used by the health SymlinkCollector to validate integrity.
   */
  async planDestinations(): Promise<SymlinkPlanEntry[]> {
    const settings =
      (await this.deps.settingsService.load()) ?? this.deps.settingsService.getDefaults();
    const enabledAdapters = this.enabledAdapters(settings);
    const entities = await this.deps.entityRepository.list();

    const entries: SymlinkPlanEntry[] = [];
    for (const entity of entities) {
      const source = this.entitySourcePath(entity, this.deps.workspacePath);
      for (const adapter of enabledAdapters) {
        const destinations = await adapter.resolveEntityDestinations({
          entity,
          linkedRepos: settings.linkedRepos,
        });
        for (const dest of destinations) {
          entries.push({
            adapterId: adapter.adapterId,
            source,
            destination: dest.destination,
            scope: dest.scope,
          });
        }
      }
    }
    return entries;
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

  private customizationSourcePath(customization: Customization, workspacePath: string): string {
    const name = customization.frontmatter.name;
    const type = customization.frontmatter.type;
    if (type === 'skill') {
      return join(workspacePath, 'skills', name);
    }
    const folder =
      type === 'agent'
        ? 'agents'
        : type === 'command'
          ? 'commands'
          : 'global-instructions';
    return join(workspacePath, folder, `${name}.md`);
  }

  private entitySourcePath(entity: Entity, workspacePath: string): string {
    if (entity.kind === 'skill') return join(workspacePath, 'skills', entity.name);
    if (entity.kind === 'agent') return join(workspacePath, 'agents', `${entity.name}.md`);
    if (entity.kind === 'instruction') return join(workspacePath, 'instructions', `${entity.name}.md`);
    throw new DomainError('validation', `Unsupported entity kind for sync: ${entity.kind}`);
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
