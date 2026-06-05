import { join } from 'node:path';
import type { CustomizationService } from './customization-service.js';
import type { PluginProvenanceService } from './plugin-provenance.js';
import type { Agent, AgentFrontmatter } from '../schemas/agent.js';
import type { AgentId } from '../../domain/agent-id.js';
import type { SyncResult } from '../../../shared/customization.js';
import type { PluginCachePort } from '../ports/plugin-cache-port.js';
import type { FileSystemPort } from '../ports/filesystem-port.js';
import type { Scope } from '../ports/scope.js';
import { agentId } from '../../domain/agent-id.js';
import { WORKSPACE_SOURCE, pluginSource } from '../../domain/customization-source.js';
import { formatCustomizationId } from '../../domain/customization-id.js';
import { parseMarkdown } from '../../infrastructure/markdown/frontmatter.js';
import { OperationNotAllowedForOriginError } from '../../domain/plugin-errors.js';
import { provenanceKey } from './plugin-provenance.js';

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

export interface PluginProvenanceDepsForAgents {
  provenance: PluginProvenanceService;
  cache: PluginCachePort;
  fs: FileSystemPort;
}

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
    const { provenance, cache, fs } = this.pluginDeps;
    const map = await provenance.forScope(scope);
    const out: Agent[] = [];
    for (const [key, pid] of map.entries()) {
      if (!key.startsWith('agent/')) continue;
      const name = key.slice('agent/'.length);
      const file = join(cache.pluginDir(scope, pid), 'agents', `${name}.md`);
      try {
        const raw = await fs.readFile(file);
        const { frontmatter, body } = parseMarkdown<AgentFrontmatter>(raw);
        out.push({
          id: agentId(name),
          frontmatter,
          source: pluginSource(pid),
          body,
        });
      } catch {
        // skip
      }
    }
    return out;
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
    await this.assertNotPluginSourced('save', input.agent.id, input.scope ?? 'personal');
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
    await this.assertNotPluginSourced('delete', input.id, input.scope ?? 'personal');
    return this.base.delete({
      id: formatCustomizationId('agent', input.id),
      removeSymlinks: input.removeSymlinks,
    });
  }

  private async assertNotPluginSourced(
    operation: 'save' | 'delete',
    id: AgentId,
    scope: Scope,
  ): Promise<void> {
    if (!this.pluginDeps) return;
    const map = await this.pluginDeps.provenance.forScope(scope);
    const pid = map.get(provenanceKey({ type: 'agent', name: id }));
    if (pid != null) {
      throw new OperationNotAllowedForOriginError(
        `Cannot ${operation} agent '${id}' provided by plugin '${pid}'`,
        { origin: 'plugin', operation },
      );
    }
  }
}
