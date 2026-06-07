import { describe, it, expect } from 'vitest';
import { McpService } from '../../../../src/main/application/services/mcp-service.js';
import type { McpConfigPort, RawMcpServer } from '../../../../src/main/application/ports/mcp-config-port.js';
import type { PluginMcpReader } from '../../../../src/main/infrastructure/mcp/plugin-mcp-reader.js';
import type { ClaudeRuntimePort } from '../../../../src/main/application/ports/claude-runtime-port.js';

function configPort(servers: RawMcpServer[]): McpConfigPort {
  return {
    read: async () => servers,
    upsert: async () => {},
    remove: async () => {},
  };
}

const noRuntime: ClaudeRuntimePort = {
  readMcpServers: async () => [],
  readMcpAuthAlerts: async () => [],
  readMcpRuntimeLogs: async () => [],
};

const noPlugins = { read: async () => [] } as unknown as PluginMcpReader;

describe('McpService.list', () => {
  it('maps a global stdio server to the DTO with transport + workspace source', async () => {
    const svc = new McpService({
      config: configPort([
        { location: { kind: 'global' }, name: 'pencil', def: { command: 'x' }, enabled: true },
      ]),
      plugins: noPlugins,
      runtime: noRuntime,
      linkedRepoPaths: async () => [],
    });

    const [server] = await svc.list();
    expect(server?.name).toBe('pencil');
    expect(server?.transport).toBe('stdio');
    expect(server?.scope).toBe('global');
    expect(server?.source).toEqual({ kind: 'workspace' });
    expect(server?.enabled).toBe(true);
  });

  it('attaches runtime-error health by exact name', async () => {
    const runtime: ClaudeRuntimePort = {
      readMcpServers: async () => [],
      readMcpAuthAlerts: async () => [],
      readMcpRuntimeLogs: async () => [{ server: 'pencil', state: 'error', detail: 'boom' }],
    };
    const svc = new McpService({
      config: configPort([
        { location: { kind: 'global' }, name: 'pencil', def: { command: 'x' }, enabled: true },
      ]),
      plugins: noPlugins,
      runtime,
      linkedRepoPaths: async () => [],
    });
    const [server] = await svc.list();
    expect(server?.health).toEqual({ state: 'error', detail: 'boom' });
  });

  it('marks plugin servers as plugin source and matches plugin runtime health name', async () => {
    const runtime: ClaudeRuntimePort = {
      readMcpServers: async () => [],
      readMcpAuthAlerts: async () => [{ name: 'plugin-serena-serena' }],
      readMcpRuntimeLogs: async () => [],
    };
    const plugins = {
      read: async () => [
        {
          location: { kind: 'plugin' as const, pluginId: 'serena', pluginDir: '/d' },
          name: 'serena',
          def: { command: 'x' },
          pluginId: 'serena',
          provenance: 'claude-code' as const,
        },
      ],
    } as unknown as PluginMcpReader;

    const svc = new McpService({
      config: configPort([]),
      plugins,
      runtime,
      linkedRepoPaths: async () => [],
    });
    const [server] = await svc.list();
    expect(server?.scope).toBe('plugin');
    expect(server?.source).toEqual({ kind: 'plugin', pluginId: 'serena', provenance: 'claude-code' });
    expect(server?.health).toEqual({ state: 'needs-auth' });
  });
});
