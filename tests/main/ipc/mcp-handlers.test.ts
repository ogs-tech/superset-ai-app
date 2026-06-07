import { describe, it, expect } from 'vitest';
import { buildMcpHandlers } from '../../../src/main/ipc/mcp-handlers.js';
import type { McpService } from '../../../src/main/application/services/mcp-service.js';
import type { McpServer } from '../../../src/shared/mcp.js';

const server: McpServer = {
  id: 'id1',
  name: 'pencil',
  transport: 'stdio',
  def: { command: 'x' },
  scope: 'global',
  source: { kind: 'workspace' },
  enabled: true,
};

function fakeService(overrides: Partial<McpService> = {}): McpService {
  return {
    list: async () => [server],
    get: async () => server,
    ...overrides,
  } as unknown as McpService;
}

describe('mcp handlers', () => {
  it('mcp.list returns the servers', async () => {
    const handlers = buildMcpHandlers(fakeService());
    expect(await handlers['mcp.list']!(undefined)).toEqual([server]);
  });

  it('mcp.get validates id and returns the server', async () => {
    const handlers = buildMcpHandlers(fakeService());
    expect(await handlers['mcp.get']!({ id: 'id1' })).toEqual(server);
  });

  it('mcp.get rejects a missing id', async () => {
    const handlers = buildMcpHandlers(fakeService());
    await expect(handlers['mcp.get']!({})).rejects.toThrow();
  });
});
