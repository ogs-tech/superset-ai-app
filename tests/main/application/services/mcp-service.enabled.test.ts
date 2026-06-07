import { describe, it, expect, vi } from 'vitest';
import { McpService } from '../../../../src/main/application/services/mcp-service.js';
import type { McpConfigPort } from '../../../../src/main/application/ports/mcp-config-port.js';
import type { PluginMcpReader } from '../../../../src/main/infrastructure/mcp/plugin-mcp-reader.js';
import type { ClaudeRuntimePort } from '../../../../src/main/application/ports/claude-runtime-port.js';
import type { McpDisabledStash } from '../../../../src/main/infrastructure/mcp/mcp-disabled-stash.js';
import { mcpServerId } from '../../../../src/main/domain/mcp-server-id.js';
import { OperationNotAllowedForOriginError } from '../../../../src/main/domain/plugin-errors.js';

const noRuntime: ClaudeRuntimePort = {
  readMcpServers: async () => [], readMcpAuthAlerts: async () => [], readMcpRuntimeLogs: async () => [],
};
const noPlugins = { read: async () => [] } as unknown as PluginMcpReader;

function makeStash(over: Partial<McpDisabledStash> = {}): McpDisabledStash {
  return { list: async () => [], park: async () => {}, take: async () => undefined, ...over } as unknown as McpDisabledStash;
}

function makePort(over: Partial<McpConfigPort> = {}): McpConfigPort {
  return { read: async () => [], upsert: async () => {}, remove: async () => {}, setDisabledShared: async () => {}, ...over } as McpConfigPort;
}

describe('McpService.setEnabled', () => {
  it('disabling a global inline server parks its def and removes it', async () => {
    const park = vi.fn(async () => {});
    const remove = vi.fn(async () => {});
    const config = makePort({
      read: async () => [{ location: { kind: 'global' }, name: 'pencil', def: { command: 'x' }, enabled: true }],
      remove,
    });
    const svc = new McpService({
      config, plugins: noPlugins, runtime: noRuntime, linkedRepoPaths: async () => [],
      disabledStash: makeStash({ park }),
    });
    const id = mcpServerId({ location: { kind: 'global' }, name: 'pencil' });
    await svc.setEnabled({ id, enabled: false });
    expect(park).toHaveBeenCalledWith(id, { command: 'x' });
    expect(remove).toHaveBeenCalledWith({ kind: 'global' }, 'pencil');
  });

  it('disabling a project-shared server uses the native disabled list', async () => {
    const setDisabledShared = vi.fn(async () => {});
    const config = makePort({
      read: async () => [{ location: { kind: 'project-shared', repoPath: '/r' }, name: 'figma', def: { type: 'sse', url: 'https://f.dev' }, enabled: true }],
      setDisabledShared,
    });
    const svc = new McpService({
      config, plugins: noPlugins, runtime: noRuntime, linkedRepoPaths: async () => ['/r'],
      disabledStash: makeStash(),
    });
    const id = mcpServerId({ location: { kind: 'project-shared', repoPath: '/r' }, name: 'figma' });
    await svc.setEnabled({ id, enabled: false });
    expect(setDisabledShared).toHaveBeenCalledWith('/r', 'figma', true);
  });

  it('enabling a parked inline server restores its def', async () => {
    const take = vi.fn(async () => ({ command: 'x' }));
    const upsert = vi.fn(async () => {});
    const config = makePort({ upsert });
    const svc = new McpService({
      config, plugins: noPlugins, runtime: noRuntime, linkedRepoPaths: async () => [],
      disabledStash: makeStash({ take }),
    });
    const id = mcpServerId({ location: { kind: 'global' }, name: 'pencil' });
    await svc.setEnabled({ id, enabled: true });
    expect(take).toHaveBeenCalledWith(id);
    expect(upsert).toHaveBeenCalledWith({ kind: 'global' }, 'pencil', { command: 'x' });
  });

  it('refuses to toggle a plugin server', async () => {
    const svc = new McpService({
      config: makePort(), plugins: noPlugins, runtime: noRuntime,
      linkedRepoPaths: async () => [], disabledStash: makeStash(),
    });
    const id = mcpServerId({ location: { kind: 'plugin', pluginId: 'serena', pluginDir: '/d' }, name: 'serena' });
    await expect(svc.setEnabled({ id, enabled: false })).rejects.toThrow(OperationNotAllowedForOriginError);
  });

  it('disabling a project-local server parks the def from the matching repo (not a same-named server in another repo)', async () => {
    const park = vi.fn(async () => {});
    const remove = vi.fn(async () => {});
    const config = makePort({
      read: async () => [
        { location: { kind: 'project-local', repoPath: '/a' }, name: 'srv', def: { command: 'a' }, enabled: true },
        { location: { kind: 'project-local', repoPath: '/b' }, name: 'srv', def: { command: 'b' }, enabled: true },
      ],
      remove,
    });
    const svc = new McpService({
      config, plugins: noPlugins, runtime: noRuntime, linkedRepoPaths: async () => ['/a', '/b'],
      disabledStash: makeStash({ park }),
    });
    const id = mcpServerId({ location: { kind: 'project-local', repoPath: '/b' }, name: 'srv' });
    await svc.setEnabled({ id, enabled: false });
    expect(park).toHaveBeenCalledWith(id, { command: 'b' });
    expect(remove).toHaveBeenCalledWith({ kind: 'project-local', repoPath: '/b' }, 'srv');
  });

  it('re-parks the def when upsert fails during enable', async () => {
    const park = vi.fn(async () => {});
    const config = makePort({
      upsert: async () => { throw new Error('disk full'); },
    });
    const svc = new McpService({
      config, plugins: noPlugins, runtime: noRuntime, linkedRepoPaths: async () => [],
      disabledStash: makeStash({ take: async () => ({ command: 'x' }), park }),
    });
    const id = mcpServerId({ location: { kind: 'global' }, name: 'pencil' });
    await expect(svc.setEnabled({ id, enabled: true })).rejects.toThrow('disk full');
    expect(park).toHaveBeenCalledWith(id, { command: 'x' });
  });

  it('list includes parked inline servers as disabled', async () => {
    const id = mcpServerId({ location: { kind: 'global' }, name: 'parked' });
    const svc = new McpService({
      config: makePort(), plugins: noPlugins, runtime: noRuntime, linkedRepoPaths: async () => [],
      disabledStash: makeStash({ list: async () => [{ id, def: { command: 'p' } }] }),
    });
    const found = (await svc.list()).find((s) => s.name === 'parked');
    expect(found?.enabled).toBe(false);
    expect(found?.scope).toBe('global');
  });
});
