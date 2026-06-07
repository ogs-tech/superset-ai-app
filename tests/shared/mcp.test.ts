import { describe, it, expect } from 'vitest';
import { isPluginMcp, type McpServer } from '../../src/shared/mcp.js';

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
});
