import { describe, it, expect } from 'vitest';
import { mcpServerId, parseMcpServerId } from '../../../src/main/domain/mcp-server-id.js';
import { McpServerIdInvalidError } from '../../../src/main/domain/mcp-errors.js';

describe('McpServerId', () => {
  it('round-trips every location kind, including plugin names with hyphens', () => {
    const refs = [
      { location: { kind: 'global' as const }, name: 'pencil' },
      { location: { kind: 'project-local' as const, repoPath: '/a/b' }, name: 'clickup' },
      { location: { kind: 'project-shared' as const, repoPath: '/a/b' }, name: 'figma' },
      {
        location: { kind: 'plugin' as const, pluginId: 'serena', pluginDir: '/d' },
        name: 'plugin-serena-serena',
      },
      { location: { kind: 'detected' as const }, name: 'claude.ai Gmail' },
    ];
    for (const ref of refs) {
      expect(parseMcpServerId(mcpServerId(ref))).toEqual(ref);
    }
  });

  it('produces an opaque, url-safe string', () => {
    const id = mcpServerId({ location: { kind: 'global' }, name: 'x' });
    expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('throws McpServerIdInvalidError on garbage', () => {
    expect(() => parseMcpServerId('!!!not-base64!!!')).toThrow(McpServerIdInvalidError);
    expect(() => parseMcpServerId('')).toThrow(McpServerIdInvalidError);
  });
});
