import type { Command } from '../schemas/command.js';
import type { CommandId } from '../../domain/command-id.js';

export interface CommandRepository {
  list(): Promise<Command[]>;
  get(query: { id: CommandId }): Promise<Command>;
  save(command: { command: Command }): Promise<Command>;
  delete(command: { id: CommandId }): Promise<void>;
  exists(query: { id: CommandId }): Promise<boolean>;
}
