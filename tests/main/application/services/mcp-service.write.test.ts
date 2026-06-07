import { describe, it, expect, vi } from 'vitest';
import { McpService } from '../../../../src/main/application/services/mcp-service.js';
import type { McpConfigPort } from '../../../../src/main/application/ports/mcp-config-port.js';
import type { PluginMcpReader } from '../../../../src/main/infrastructure/mcp/plugin-mcp-reader.js';
import type { ClaudeRuntimePort } from '../../../../src/main/application/ports/claude-runtime-port.js';
import { OperationNotAllowedForOriginError } from '../../../../src/main/domain/plugin-errors.js';
import { mcpServerId } from '../../../../src/main/domain/mcp-server-id.js';

const noRuntime: ClaudeRuntimePort = {
  readMcpServers: async () => [],
  readMcpAuthAlerts: async () => [],
  readMcpRuntimeLogs: async () => [],
};
const noPlugins = { read: async () => [] } as unknown as PluginMcpReader;

function makeService(config: McpConfigPort) {
  return new McpService({ config, plugins: noPlugins, runtime: noRuntime, linkedRepoPaths: async () => [] });
}

describe('McpService write', () => {
  it('save upserts a valid global stdio server', async () => {
    const upsert = vi.fn(async () => {});
    const svc = makeService({ read: async () => [], upsert, remove: async () => {}, setDisabledShared: async () => {} });
    await svc.save({
      server: { name: 'pencil', scope: 'global', def: { command: 'x' } },
      isCreate: true,
    });
    expect(upsert).toHaveBeenCalledWith({ kind: 'global' }, 'pencil', { command: 'x' });
  });

  it('save rejects an invalid def', async () => {
    const svc = makeService({ read: async () => [], upsert: async () => {}, remove: async () => {}, setDisabledShared: async () => {} });
    await expect(
      svc.save({ server: { name: 'bad', scope: 'global', def: { nope: true } } }),
    ).rejects.toThrow();
  });

  it('save of a project-shared server requires repoPath', async () => {
    const svc = makeService({ read: async () => [], upsert: async () => {}, remove: async () => {}, setDisabledShared: async () => {} });
    await expect(
      svc.save({ server: { name: 'figma', scope: 'project-shared', def: { type: 'sse', url: 'https://f.dev' } } }),
    ).rejects.toThrow(/repoPath/);
  });

  it('delete refuses a plugin-sourced id', async () => {
    const svc = makeService({ read: async () => [], upsert: async () => {}, remove: async () => {}, setDisabledShared: async () => {} });
    const pluginId = mcpServerId({
      location: { kind: 'plugin', pluginId: 'serena', pluginDir: '/d' },
      name: 'serena',
    });
    await expect(svc.delete({ id: pluginId })).rejects.toThrow(OperationNotAllowedForOriginError);
  });

  it('save rejects an empty name', async () => {
    const upsert = vi.fn(async () => {});
    const svc = makeService({ read: async () => [], upsert, remove: async () => {}, setDisabledShared: async () => {} });
    await expect(
      svc.save({ server: { name: '   ', scope: 'global', def: { command: 'x' } } }),
    ).rejects.toThrow(/name/);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('save rejects an invalid scope', async () => {
    const upsert = vi.fn(async () => {});
    const svc = makeService({ read: async () => [], upsert, remove: async () => {}, setDisabledShared: async () => {} });
    await expect(
      svc.save({ server: { name: 'x', scope: 'evil' as never, def: { command: 'x' } } }),
    ).rejects.toThrow(/scope/);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('delete removes a workspace server by id', async () => {
    const remove = vi.fn(async () => {});
    const svc = makeService({ read: async () => [], upsert: async () => {}, remove, setDisabledShared: async () => {} });
    const id = mcpServerId({ location: { kind: 'global' }, name: 'pencil' });
    await svc.delete({ id });
    expect(remove).toHaveBeenCalledWith({ kind: 'global' }, 'pencil');
  });
});
