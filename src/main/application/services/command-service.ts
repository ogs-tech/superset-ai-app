import { join } from 'node:path';
import type { CustomizationService } from './customization-service.js';
import type { PluginProvenanceService } from './plugin-provenance.js';
import type { Command, CommandFrontmatter } from '../schemas/command.js';
import type { CommandId } from '../../domain/command-id.js';
import type { SyncResult } from '../../../shared/customization.js';
import type { PluginCachePort } from '../ports/plugin-cache-port.js';
import type { FileSystemPort } from '../ports/filesystem-port.js';
import type { Scope } from '../ports/scope.js';
import { commandId } from '../../domain/command-id.js';
import { WORKSPACE_SOURCE, pluginSource } from '../../domain/customization-source.js';
import { formatCustomizationId } from '../../domain/customization-id.js';
import { parseMarkdown } from '../markdown/frontmatter.js';
import { OperationNotAllowedForOriginError } from '../../domain/plugin-errors.js';
import { provenanceKey } from './plugin-provenance.js';

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

export interface PluginProvenanceDepsForCommands {
  provenance: PluginProvenanceService;
  cache: PluginCachePort;
  fs: FileSystemPort;
}

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
    const { provenance, cache, fs } = this.pluginDeps;
    const map = await provenance.forScope(scope);
    const out: Command[] = [];
    for (const [key, pid] of map.entries()) {
      if (!key.startsWith('command/')) continue;
      const name = key.slice('command/'.length);
      const file = join(cache.pluginDir(scope, pid), 'commands', `${name}.md`);
      try {
        const raw = await fs.readFile(file);
        const { frontmatter, body } = parseMarkdown<Partial<CommandFrontmatter>>(raw);
        out.push({
          id: commandId(name),
          frontmatter: { ...frontmatter, name, type: 'command' } as CommandFrontmatter,
          source: pluginSource(pid),
          body,
        });
      } catch {
        // skip
      }
    }
    return out;
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
    await this.assertNotPluginSourced('save', input.command.id, input.scope ?? 'personal');
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

  async delete(input: {
    id: CommandId;
    removeSymlinks: boolean;
    scope?: Scope;
  }): Promise<{
    ok: true;
    syncReport?: SyncResult[];
  }> {
    await this.assertNotPluginSourced('delete', input.id, input.scope ?? 'personal');
    return this.base.delete({
      id: formatCustomizationId('command', input.id),
      removeSymlinks: input.removeSymlinks,
    });
  }

  private async assertNotPluginSourced(
    operation: 'save' | 'delete',
    id: CommandId,
    scope: Scope,
  ): Promise<void> {
    if (!this.pluginDeps) return;
    const map = await this.pluginDeps.provenance.forScope(scope);
    const pid = map.get(provenanceKey({ type: 'command', name: id }));
    if (pid != null) {
      throw new OperationNotAllowedForOriginError(
        `Cannot ${operation} command '${id}' provided by plugin '${pid}'`,
        { origin: 'plugin', operation },
      );
    }
  }
}
