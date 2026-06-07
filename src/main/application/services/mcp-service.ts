import type { McpConfigPort, RawMcpServer } from '../ports/mcp-config-port.js';
import type { ClaudeRuntimePort } from '../ports/claude-runtime-port.js';
import type { PluginMcpReader, PluginMcpServer } from '../../infrastructure/mcp/plugin-mcp-reader.js';
import type { McpServer, McpHealth, McpScope, McpServerInput } from '../../../shared/mcp.js';
import { transportOf, mcpServerDefSchema } from '../schemas/mcp.js';
import { mcpServerId, parseMcpServerId, type McpServerRef } from '../../domain/mcp-server-id.js';
import { locationRepoPath } from '../../domain/mcp-location.js';
import type { McpLocation } from '../../domain/mcp-location.js';
import { OperationNotAllowedForOriginError } from '../../domain/plugin-errors.js';
import { DomainError } from '../../domain/errors.js';
import type { McpDisabledStash } from '../../infrastructure/mcp/mcp-disabled-stash.js';
import type { ShellPort } from '../ports/shell-port.js';

export interface McpServiceDeps {
  config: McpConfigPort;
  plugins: PluginMcpReader;
  runtime: ClaudeRuntimePort;
  /** Linked repo paths whose .mcp.json should be read. */
  linkedRepoPaths: () => Promise<string[]>;
  /** Optional stash for parking/restoring disabled inline (global/project-local) servers. */
  disabledStash?: McpDisabledStash;
  /** Optional shell, used to open the external claude.ai auth flow. */
  shell?: ShellPort;
}

/** Where needs-auth claude.ai connectors are (re-)authenticated. */
const CLAUDE_AI_CONNECTORS_URL = 'https://claude.ai/settings/connectors';

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

    // Names already represented by a config/plugin/parked row, so the health
    // join doesn't double-list them as detected orphans below.
    const claimed = new Set<string>();
    for (const s of config) claimed.add(s.name);
    for (const s of plugins) {
      claimed.add(`plugin-${s.pluginId}-${s.name}`);
      claimed.add(s.name);
    }

    const stash = this.deps.disabledStash;
    const parked = stash
      ? (await stash.list()).map((entry) => {
          const ref = parseMcpServerId(entry.id);
          claimed.add(ref.name);
          return this.toDto(
            { location: ref.location, name: ref.name, def: entry.def, enabled: false },
            { kind: 'workspace' },
            health,
          );
        })
      : [];

    const detected = this.detectedOrphans(health, claimed);

    return [...own, ...fromPlugins, ...parked, ...detected];
  }

  /**
   * Re-authenticates a needs-auth server by opening the external claude.ai
   * connectors page. The app cannot complete the OAuth flow itself (it has no
   * def/URL for runtime-managed connectors), so it acts as a trampoline.
   */
  async authenticate(input: { id: string }): Promise<{ ok: true }> {
    parseMcpServerId(input.id); // validate the id round-trips; throws on garbage
    const shell = this.deps.shell;
    if (shell === undefined) {
      throw new DomainError('internal', 'MCP shell port is not configured');
    }
    await shell.openExternal(CLAUDE_AI_CONNECTORS_URL);
    return { ok: true };
  }

  async get(id: string): Promise<McpServer | undefined> {
    const ref = parseMcpServerId(id);
    return (await this.list()).find((s) => s.id === mcpServerId(ref));
  }

  async save(input: { server: McpServerInput; isCreate?: boolean }): Promise<{ ok: true }> {
    const { server } = input;
    if (server.name.trim().length === 0) {
      throw new DomainError('validation', 'MCP server name must not be empty');
    }
    const def = mcpServerDefSchema.parse(server.def); // throws validation on bad def
    const location = this.inputLocation(server);
    await this.deps.config.upsert(location, server.name, def);
    return { ok: true };
  }

  async delete(input: { id: string }): Promise<{ ok: true }> {
    const ref = parseMcpServerId(input.id);
    if (ref.location.kind === 'plugin') {
      throw new OperationNotAllowedForOriginError(
        `Cannot delete MCP server '${ref.name}' provided by plugin '${ref.location.pluginId}'`,
        { origin: 'plugin', operation: 'delete' },
      );
    }
    if (ref.location.kind === 'detected') {
      throw new OperationNotAllowedForOriginError(
        `Cannot delete detected MCP server '${ref.name}': it has no broker config`,
        { origin: 'detected', operation: 'delete' },
      );
    }
    await this.deps.config.remove(ref.location, ref.name);
    return { ok: true };
  }

  async setEnabled(input: { id: string; enabled: boolean }): Promise<{ ok: true }> {
    const ref = parseMcpServerId(input.id);
    if (ref.location.kind === 'plugin') {
      throw new OperationNotAllowedForOriginError(
        `Cannot toggle MCP server '${ref.name}' provided by plugin '${ref.location.pluginId}'`,
        { origin: 'plugin', operation: 'save' },
      );
    }
    if (ref.location.kind === 'detected') {
      throw new OperationNotAllowedForOriginError(
        `Cannot toggle detected MCP server '${ref.name}': it has no broker config`,
        { origin: 'detected', operation: 'save' },
      );
    }
    if (ref.location.kind === 'project-shared') {
      await this.deps.config.setDisabledShared(ref.location.repoPath, ref.name, !input.enabled);
      return { ok: true };
    }
    // Inline (global/project-local): the stash and config are separate stores; each direction compensates on failure to stay consistent.
    const stash = this.deps.disabledStash;
    if (stash === undefined) {
      throw new DomainError('internal', 'MCP disabled stash is not configured');
    }
    if (input.enabled) {
      const def = await stash.take(input.id);
      if (def !== undefined) {
        try {
          await this.deps.config.upsert(ref.location, ref.name, def);
        } catch (err) {
          // Cross-store op is not atomic: restore the parked def so it isn't lost.
          await stash.park(input.id, def);
          throw err;
        }
      }
      return { ok: true };
    }
    const current = (await this.deps.config.read({ repoPaths: await this.deps.linkedRepoPaths() })).find(
      (s) =>
        s.name === ref.name &&
        s.location.kind === ref.location.kind &&
        locationRepoPath(s.location) === locationRepoPath(ref.location),
    );
    if (current !== undefined) {
      await stash.park(input.id, current.def);
      try {
        await this.deps.config.remove(ref.location, ref.name);
      } catch (err) {
        // Cross-store op is not atomic: undo the park so the server isn't double-listed.
        await stash.take(input.id);
        throw err;
      }
    }
    return { ok: true };
  }

  private inputLocation(server: McpServerInput): McpLocation {
    const ALLOWED = new Set(['global', 'project-local', 'project-shared']);
    if (!ALLOWED.has(server.scope)) {
      throw new DomainError('validation', `Invalid MCP scope '${String(server.scope)}'`);
    }
    if (server.scope === 'global') return { kind: 'global' };
    if (server.repoPath === undefined || server.repoPath.length === 0) {
      throw new DomainError('validation', `Missing 'repoPath' for scope '${server.scope}'`);
    }
    return { kind: server.scope, repoPath: server.repoPath };
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

  /**
   * Servers the Claude Code runtime knows about (via logs / needs-auth cache)
   * that have a health problem AND no broker-readable config. Surfaced read-only
   * so failures — notably needs-auth claude.ai connectors — are visible and the
   * user can act on them; healthy orphans are intentionally omitted to avoid noise.
   */
  private detectedOrphans(health: Map<string, McpHealth>, claimed: Set<string>): McpServer[] {
    const out: McpServer[] = [];
    for (const [name, h] of health) {
      if (h.state !== 'error' && h.state !== 'needs-auth') continue;
      if (claimed.has(name)) continue;
      out.push(this.detectedDto(name, h));
    }
    return out;
  }

  private detectedDto(name: string, health: McpHealth): McpServer {
    const ref: McpServerRef = { location: { kind: 'detected' }, name };
    return {
      id: mcpServerId(ref),
      name,
      def: {},
      scope: 'detected',
      source: { kind: 'detected' },
      enabled: false,
      health,
    };
  }

  private async buildHealthMap(): Promise<Map<string, McpHealth>> {
    const [logs, alerts] = await Promise.all([
      this.deps.runtime.readMcpRuntimeLogs(),
      this.deps.runtime.readMcpAuthAlerts(),
    ]);
    // Keyed by bare server name: runtime logs are name-only, so health is matched by name alone.
    // Two servers with the same name in different scopes (e.g. global + project-local) will share
    // the same health entry — an acceptable limitation given the runtime's flat namespace.
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
