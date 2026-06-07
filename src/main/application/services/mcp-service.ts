import type { McpConfigPort, RawMcpServer } from '../ports/mcp-config-port.js';
import type { ClaudeRuntimePort } from '../ports/claude-runtime-port.js';
import type { PluginMcpReader, PluginMcpServer } from '../../infrastructure/mcp/plugin-mcp-reader.js';
import type { McpServer, McpHealth, McpScope } from '../../../shared/mcp.js';
import { transportOf } from '../schemas/mcp.js';
import { mcpServerId, parseMcpServerId, type McpServerRef } from '../../domain/mcp-server-id.js';
import { locationRepoPath } from '../../domain/mcp-location.js';

export interface McpServiceDeps {
  config: McpConfigPort;
  plugins: PluginMcpReader;
  runtime: ClaudeRuntimePort;
  /** Linked repo paths whose .mcp.json should be read. */
  linkedRepoPaths: () => Promise<string[]>;
}

export class McpService {
  constructor(private readonly deps: McpServiceDeps) {}

  async list(): Promise<McpServer[]> {
    const repoPaths = await this.deps.linkedRepoPaths();
    const [config, plugins] = await Promise.all([
      this.deps.config.read({ repoPaths }),
      this.deps.plugins.read('personal'),
    ]);
    const health = await this.buildHealthMap();

    const own = config.map((s) => this.toDto(s, { kind: 'workspace' }, health));
    const fromPlugins = plugins.map((s) => this.pluginToDto(s, health));
    return [...own, ...fromPlugins];
  }

  async get(id: string): Promise<McpServer | undefined> {
    const ref = parseMcpServerId(id);
    return (await this.list()).find((s) => s.id === mcpServerId(ref));
  }

  private toDto(
    raw: RawMcpServer,
    source: McpServer['source'],
    health: Map<string, McpHealth>,
  ): McpServer {
    const ref: McpServerRef = { location: raw.location, name: raw.name };
    const repoPath = locationRepoPath(raw.location);
    const found = health.get(raw.name);
    return {
      id: mcpServerId(ref),
      name: raw.name,
      transport: transportOf(raw.def),
      def: raw.def as Record<string, unknown>,
      scope: raw.location.kind as McpScope,
      ...(repoPath !== undefined ? { repoPath } : {}),
      source,
      enabled: raw.enabled,
      ...(found !== undefined ? { health: found } : {}),
    };
  }

  private pluginToDto(s: PluginMcpServer, health: Map<string, McpHealth>): McpServer {
    const ref: McpServerRef = { location: s.location, name: s.name };
    const runtimeName = `plugin-${s.pluginId}-${s.name}`;
    const found = health.get(runtimeName) ?? health.get(s.name);
    return {
      id: mcpServerId(ref),
      name: s.name,
      transport: transportOf(s.def),
      def: s.def as Record<string, unknown>,
      scope: 'plugin',
      source: { kind: 'plugin', pluginId: s.pluginId, provenance: s.provenance },
      enabled: true,
      ...(found !== undefined ? { health: found } : {}),
    };
  }

  private async buildHealthMap(): Promise<Map<string, McpHealth>> {
    const [logs, alerts] = await Promise.all([
      this.deps.runtime.readMcpRuntimeLogs(),
      this.deps.runtime.readMcpAuthAlerts(),
    ]);
    const map = new Map<string, McpHealth>();
    for (const log of logs) {
      map.set(log.server, {
        state: log.state,
        ...(log.detail !== undefined ? { detail: log.detail } : {}),
      });
    }
    // Auth-needed wins over an otherwise-ok status.
    for (const alert of alerts) map.set(alert.name, { state: 'needs-auth' });
    return map;
  }
}
