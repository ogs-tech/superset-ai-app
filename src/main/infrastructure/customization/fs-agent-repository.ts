import type { CustomizationRepository } from '../../application/ports/customization-repository.js';
import type { AgentRepository } from '../../application/ports/agent-repository.js';
import type { Agent, AgentFrontmatter } from '../../application/schemas/agent.js';
import { agentId, type AgentId } from '../../domain/agent-id.js';
import { WORKSPACE_SOURCE } from '../../domain/customization-source.js';
import { formatCustomizationId } from '../../domain/customization-id.js';

function toAgent(c: { id: string; frontmatter: unknown; body: string }): Agent {
  const fm = c.frontmatter as AgentFrontmatter;
  return {
    id: agentId(fm.name),
    frontmatter: fm,
    source: WORKSPACE_SOURCE,
    body: c.body,
  };
}

export class FsAgentRepository implements AgentRepository {
  constructor(private readonly base: CustomizationRepository) {}

  async list(): Promise<Agent[]> {
    const items = await this.base.list({ type: 'agent' });
    return items.map(toAgent);
  }

  async get(query: { id: AgentId }): Promise<Agent> {
    const c = await this.base.get({ id: formatCustomizationId('agent', query.id) });
    return toAgent(c);
  }

  async save(command: { agent: Agent }): Promise<Agent> {
    const saved = await this.base.save({
      customization: {
        id: formatCustomizationId('agent', command.agent.id),
        frontmatter: command.agent.frontmatter as never,
        body: command.agent.body,
      },
    });
    return toAgent(saved);
  }

  async delete(command: { id: AgentId }): Promise<void> {
    await this.base.delete({ id: formatCustomizationId('agent', command.id) });
  }

  async exists(query: { id: AgentId }): Promise<boolean> {
    return this.base.exists({ id: formatCustomizationId('agent', query.id) });
  }
}
