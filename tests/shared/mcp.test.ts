import { describe, it, expect } from 'vitest';
import { isPluginMcp, needsAuth, type McpServer } from '../../src/shared/mcp.js';

const base: McpServer = {
  id: 'abc',
  name: 'pencil',
  transport: 'stdio',
  def: { command: 'x' },
  scope: 'global',
  source: { kind: 'workspace' },
  enabled: true,
};

describe('shared/mcp', () => {
  it('isPluginMcp is true only for plugin source', () => {
    expect(isPluginMcp(base)).toBe(false);
    expect(
      isPluginMcp({
        ...base,
        scope: 'plugin',
        source: { kind: 'plugin', pluginId: 'serena', provenance: 'claude-code' },
      }),
    ).toBe(true);
  });

  it('needsAuth is true only when health state is needs-auth', () => {
    expect(needsAuth(base)).toBe(false);
    expect(needsAuth({ ...base, health: { state: 'error' } })).toBe(false);
    expect(needsAuth({ ...base, health: { state: 'needs-auth' } })).toBe(true);
  });
});
