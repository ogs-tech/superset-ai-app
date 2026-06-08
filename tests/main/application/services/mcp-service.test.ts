import { describe, it, expect, vi } from 'vitest';
import { McpService } from '../../../../src/main/application/services/mcp-service.js';
import type { McpConfigPort, RawMcpServer } from '../../../../src/main/application/ports/mcp-config-port.js';
import type { PluginMcpReader } from '../../../../src/main/infrastructure/mcp/plugin-mcp-reader.js';
import type { ClaudeRuntimePort } from '../../../../src/main/application/ports/claude-runtime-port.js';
import type { ShellPort } from '../../../../src/main/application/ports/shell-port.js';
import { mcpServerId } from '../../../../src/main/domain/mcp-server-id.js';

function configPort(servers: RawMcpServer[]): McpConfigPort {
  return {
    read: async () => servers,
    upsert: async () => {},
    remove: async () => {},
    setDisabledShared: async () => {},
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

describe('McpService.list — detected orphans', () => {
  it('surfaces a needs-auth connector with no config as a read-only detected row', async () => {
    const runtime: ClaudeRuntimePort = {
      readMcpServers: async () => [],
      readMcpAuthAlerts: async () => [{ name: 'claude.ai Gmail' }],
      readMcpRuntimeLogs: async () => [],
    };
    const svc = new McpService({
      config: configPort([]),
      plugins: noPlugins,
      runtime,
      linkedRepoPaths: async () => [],
    });

    const [server] = await svc.list();
    expect(server?.name).toBe('claude.ai Gmail');
    expect(server?.scope).toBe('detected');
    expect(server?.source).toEqual({ kind: 'detected' });
    expect(server?.transport).toBeUndefined();
    expect(server?.health).toEqual({ state: 'needs-auth' });
  });

  it('surfaces a runtime-error server with no config as detected', async () => {
    const runtime: ClaudeRuntimePort = {
      readMcpServers: async () => [],
      readMcpAuthAlerts: async () => [],
      readMcpRuntimeLogs: async () => [{ server: 'ghost', state: 'error', detail: 'failed to connect' }],
    };
    const svc = new McpService({
      config: configPort([]),
      plugins: noPlugins,
      runtime,
      linkedRepoPaths: async () => [],
    });

    const [server] = await svc.list();
    expect(server?.name).toBe('ghost');
    expect(server?.scope).toBe('detected');
    expect(server?.health).toEqual({ state: 'error', detail: 'failed to connect' });
  });

  it('omits healthy (ok/warning) orphans to avoid noise', async () => {
    const runtime: ClaudeRuntimePort = {
      readMcpServers: async () => [],
      readMcpAuthAlerts: async () => [],
      readMcpRuntimeLogs: async () => [
        { server: 'fine', state: 'ok' },
        { server: 'noisy', state: 'warning', detail: 'deprecation' },
      ],
    };
    const svc = new McpService({
      config: configPort([]),
      plugins: noPlugins,
      runtime,
      linkedRepoPaths: async () => [],
    });

    expect(await svc.list()).toEqual([]);
  });

  it('does not double-list a configured server that also has error health', async () => {
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

    const list = await svc.list();
    expect(list).toHaveLength(1);
    expect(list[0]?.source).toEqual({ kind: 'workspace' });
    expect(list[0]?.health).toEqual({ state: 'error', detail: 'boom' });
  });

  it('does not double-list a plugin server matched by its runtime name', async () => {
    const runtime: ClaudeRuntimePort = {
      readMcpServers: async () => [],
      readMcpAuthAlerts: async () => [],
      readMcpRuntimeLogs: async () => [{ server: 'plugin-serena-serena', state: 'error', detail: 'boom' }],
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

    const list = await svc.list();
    expect(list).toHaveLength(1);
    expect(list[0]?.source).toEqual({ kind: 'plugin', pluginId: 'serena', provenance: 'claude-code' });
  });
});

describe('McpService.authenticate', () => {
  function openExternalShell(): { shell: ShellPort; opened: string[] } {
    const opened: string[] = [];
    return { shell: { openExternal: async (url) => void opened.push(url) }, opened };
  }

  it('opens the claude.ai connectors page in the browser', async () => {
    const { shell, opened } = openExternalShell();
    const svc = new McpService({
      config: configPort([]),
      plugins: noPlugins,
      runtime: noRuntime,
      linkedRepoPaths: async () => [],
      shell,
    });

    const id = mcpServerId({ location: { kind: 'detected' }, name: 'claude.ai Gmail' });
    await expect(svc.authenticate({ id })).resolves.toEqual({ ok: true });
    expect(opened).toEqual(['https://claude.ai/customize/connectors']);
  });

  it('throws on a malformed id without opening anything', async () => {
    const { shell, opened } = openExternalShell();
    const svc = new McpService({
      config: configPort([]),
      plugins: noPlugins,
      runtime: noRuntime,
      linkedRepoPaths: async () => [],
      shell,
    });

    await expect(svc.authenticate({ id: 'not-a-valid-id' })).rejects.toThrow();
    expect(opened).toEqual([]);
  });

  it('throws when no shell port is configured', async () => {
    const svc = new McpService({
      config: configPort([]),
      plugins: noPlugins,
      runtime: noRuntime,
      linkedRepoPaths: async () => [],
    });
    const id = mcpServerId({ location: { kind: 'detected' }, name: 'x' });
    await expect(svc.authenticate({ id })).rejects.toThrow(/shell port/i);
  });
});

describe('McpService — detected guards', () => {
  function svc(): McpService {
    return new McpService({
      config: {
        read: async () => [],
        upsert: vi.fn(async () => {}),
        remove: vi.fn(async () => {}),
        setDisabledShared: vi.fn(async () => {}),
      },
      plugins: noPlugins,
      runtime: noRuntime,
      linkedRepoPaths: async () => [],
    });
  }

  it('refuses to delete a detected server', async () => {
    const id = mcpServerId({ location: { kind: 'detected' }, name: 'claude.ai Gmail' });
    await expect(svc().delete({ id })).rejects.toThrow(/detected/i);
  });

  it('refuses to toggle a detected server', async () => {
    const id = mcpServerId({ location: { kind: 'detected' }, name: 'claude.ai Gmail' });
    await expect(svc().setEnabled({ id, enabled: false })).rejects.toThrow(/detected/i);
  });
});
