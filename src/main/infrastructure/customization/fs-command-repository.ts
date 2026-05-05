import type { CustomizationRepository } from '../../application/ports/customization-repository.js';
import type { CommandRepository } from '../../application/ports/command-repository.js';
import type { Command, CommandFrontmatter } from '../../application/schemas/command.js';
import { commandId, type CommandId } from '../../domain/command-id.js';
import { WORKSPACE_SOURCE } from '../../domain/customization-source.js';
import { formatCustomizationId } from '../../domain/customization-id.js';

function toCommand(c: { id: string; frontmatter: unknown; body: string }): Command {
  const fm = c.frontmatter as CommandFrontmatter;
  return {
    id: commandId(fm.name),
    frontmatter: fm,
    source: WORKSPACE_SOURCE,
    body: c.body,
  };
}

export class FsCommandRepository implements CommandRepository {
  constructor(private readonly base: CustomizationRepository) {}

  async list(): Promise<Command[]> {
    const items = await this.base.list({ type: 'command' });
    return items.map(toCommand);
  }

  async get(query: { id: CommandId }): Promise<Command> {
    const c = await this.base.get({ id: formatCustomizationId('command', query.id) });
    return toCommand(c);
  }

  async save(command: { command: Command }): Promise<Command> {
    const saved = await this.base.save({
      customization: {
        id: formatCustomizationId('command', command.command.id),
        frontmatter: command.command.frontmatter as never,
        body: command.command.body,
      },
    });
    return toCommand(saved);
  }

  async delete(command: { id: CommandId }): Promise<void> {
    await this.base.delete({ id: formatCustomizationId('command', command.id) });
  }

  async exists(query: { id: CommandId }): Promise<boolean> {
    return this.base.exists({ id: formatCustomizationId('command', query.id) });
  }
}
