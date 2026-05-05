import type { Agent } from '../schemas/agent.js';
import type { AgentId } from '../../domain/agent-id.js';

export interface AgentRepository {
  list(): Promise<Agent[]>;
  get(query: { id: AgentId }): Promise<Agent>;
  save(command: { agent: Agent }): Promise<Agent>;
  delete(command: { id: AgentId }): Promise<void>;
  exists(query: { id: AgentId }): Promise<boolean>;
}
