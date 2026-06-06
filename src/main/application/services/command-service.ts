import type { CustomizationService } from './customization-service.js';
import type { Command, CommandFrontmatter } from '../schemas/command.js';
import type { CommandId } from '../../domain/command-id.js';
import type { SyncResult } from '../../../shared/customization.js';
import type { Scope } from '../ports/scope.js';
import { commandId } from '../../domain/command-id.js';
import { WORKSPACE_SOURCE, pluginSource } from '../../domain/customization-source.js';
import { formatCustomizationId } from '../../domain/customization-id.js';
import { OperationNotAllowedForOriginError } from '../../domain/plugin-errors.js';
import {
  collectPluginEntities,
  assertNotPluginSourced,
  type PluginEntityDeps,
} from './customization-plugin-helpers.js';

export interface SaveCommandResult {
  command: Command;
  syncReport: SyncResult[];
}

function toCommand(c: { id: string; frontmatter: unknown; body: string }): Command {
  const fm = c.frontmatter as CommandFrontmatter;
  return {
    id: commandId(fm.name),
    frontmatter: fm,
    source: WORKSPACE_SOURCE,
    body: c.body,
  };
}

export type PluginProvenanceDepsForCommands = PluginEntityDeps;

export class CommandService {
  constructor(
    private readonly base: CustomizationService,
    private readonly pluginDeps?: PluginProvenanceDepsForCommands,
  ) {}

  async list(scope: Scope = 'personal'): Promise<Command[]> {
    const workspace = (await this.base.list({ type: 'command' })).map(toCommand);
    if (!this.pluginDeps) return workspace;

    const pluginCommands = await this.collectPluginCommands(scope);
    const workspaceIds = new Set(workspace.map((c) => c.id));
    return [...workspace, ...pluginCommands.filter((c) => !workspaceIds.has(c.id))];
  }

  private async collectPluginCommands(scope: Scope): Promise<Command[]> {
    if (!this.pluginDeps) return [];
    return collectPluginEntities(
      this.pluginDeps,
      {
        keyPrefix: 'command/',
        relPath: (name) => `commands/${name}.md`,
        build: ({ name, frontmatter, body, pluginId }) => ({
          id: commandId(name),
          frontmatter: {
            ...(frontmatter as Partial<CommandFrontmatter>),
            name,
            type: 'command',
          } as CommandFrontmatter,
          source: pluginSource(pluginId),
          body,
        }),
      },
      scope,
    );
  }

  async get(id: CommandId): Promise<Command> {
    const c = await this.base.get({ id: formatCustomizationId('command', id) });
    return toCommand(c);
  }

  async save(input: {
    command: Command;
    isCreate?: boolean;
    scope?: Scope;
  }): Promise<SaveCommandResult> {
    if (input.command.source.kind === 'plugin') {
      throw new OperationNotAllowedForOriginError(
        `Cannot save a command provided by plugin '${input.command.source.pluginId}'`,
        { origin: 'plugin', operation: 'save' },
      );
    }
    await assertNotPluginSourced(this.pluginDeps, {
      type: 'command',
      operation: 'save',
      name: input.command.id,
      scope: input.scope ?? 'personal',
    });
    const result = await this.base.save({
      customization: {
        id: formatCustomizationId('command', input.command.id),
        frontmatter: input.command.frontmatter as never,
        body: input.command.body,
      },
      ...(input.isCreate !== undefined ? { isCreate: input.isCreate } : {}),
    });
    return {
      command: toCommand(result.customization),
      syncReport: result.syncReport,
    };
  }

  async delete(input: { id: CommandId; removeSymlinks: boolean; scope?: Scope }): Promise<{
    ok: true;
    syncReport?: SyncResult[];
  }> {
    await assertNotPluginSourced(this.pluginDeps, {
      type: 'command',
      operation: 'delete',
      name: input.id,
      scope: input.scope ?? 'personal',
    });
    return this.base.delete({
      id: formatCustomizationId('command', input.id),
      removeSymlinks: input.removeSymlinks,
    });
  }
}
