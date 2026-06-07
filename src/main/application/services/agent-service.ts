import type { CustomizationService } from './customization-service.js';
import type { Agent, AgentFrontmatter } from '../schemas/agent.js';
import type { AgentId } from '../../domain/agent-id.js';
import type { SyncResult } from '../../../shared/customization.js';
import type { Scope } from '../ports/scope.js';
import { agentId } from '../../domain/agent-id.js';
import { WORKSPACE_SOURCE, pluginSource } from '../../domain/customization-source.js';
import { formatCustomizationId } from '../../domain/customization-id.js';
import { OperationNotAllowedForOriginError } from '../../domain/plugin-errors.js';
import {
  collectPluginEntities,
  assertNotPluginSourced,
  type PluginEntityDeps,
} from './customization-plugin-helpers.js';

export interface SaveAgentResult {
  agent: Agent;
  syncReport: SyncResult[];
}

function toAgent(c: { id: string; frontmatter: unknown; body: string }): Agent {
  const fm = c.frontmatter as AgentFrontmatter;
  return {
    id: agentId(fm.name),
    frontmatter: fm,
    source: WORKSPACE_SOURCE,
    body: c.body,
  };
}

export type PluginProvenanceDepsForAgents = PluginEntityDeps;

export class AgentService {
  constructor(
    private readonly base: CustomizationService,
    private readonly pluginDeps?: PluginProvenanceDepsForAgents,
  ) {}

  async list(scope: Scope = 'personal'): Promise<Agent[]> {
    const workspace = (await this.base.list({ type: 'agent' })).map(toAgent);
    if (!this.pluginDeps) return workspace;

    const pluginAgents = await this.collectPluginAgents(scope);
    const workspaceIds = new Set(workspace.map((a) => a.id));
    return [...workspace, ...pluginAgents.filter((a) => !workspaceIds.has(a.id))];
  }

  private async collectPluginAgents(scope: Scope): Promise<Agent[]> {
    if (!this.pluginDeps) return [];
    return collectPluginEntities(
      this.pluginDeps,
      {
        keyPrefix: 'agent/',
        relPath: (name) => `agents/${name}.md`,
        build: ({ name, frontmatter, body, pluginId, provenance }) => ({
          id: agentId(name),
          frontmatter: frontmatter as AgentFrontmatter,
          source: pluginSource(pluginId, provenance),
          body,
        }),
      },
      scope,
    );
  }

  async get(id: AgentId): Promise<Agent> {
    const c = await this.base.get({ id: formatCustomizationId('agent', id) });
    return toAgent(c);
  }

  async save(input: { agent: Agent; isCreate?: boolean; scope?: Scope }): Promise<SaveAgentResult> {
    if (input.agent.source.kind === 'plugin') {
      throw new OperationNotAllowedForOriginError(
        `Cannot save an agent provided by plugin '${input.agent.source.pluginId}'`,
        { origin: 'plugin', operation: 'save' },
      );
    }
    await assertNotPluginSourced(this.pluginDeps, {
      type: 'agent',
      operation: 'save',
      name: input.agent.id,
      scope: input.scope ?? 'personal',
    });
    const result = await this.base.save({
      customization: {
        id: formatCustomizationId('agent', input.agent.id),
        frontmatter: input.agent.frontmatter as never,
        body: input.agent.body,
      },
      ...(input.isCreate !== undefined ? { isCreate: input.isCreate } : {}),
    });
    return {
      agent: toAgent(result.customization),
      syncReport: result.syncReport,
    };
  }

  async delete(input: { id: AgentId; removeSymlinks: boolean; scope?: Scope }): Promise<{
    ok: true;
    syncReport?: SyncResult[];
  }> {
    await assertNotPluginSourced(this.pluginDeps, {
      type: 'agent',
      operation: 'delete',
      name: input.id,
      scope: input.scope ?? 'personal',
    });
    return this.base.delete({
      id: formatCustomizationId('agent', input.id),
      removeSymlinks: input.removeSymlinks,
    });
  }
}
