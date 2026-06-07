import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PluginMcpReader } from '../../../../src/main/infrastructure/mcp/plugin-mcp-reader.js';
import type { PluginRoot } from '../../../../src/main/application/services/plugin-provenance.js';

describe('PluginMcpReader', () => {
  let tmp: string;
  beforeEach(async () => {
    tmp = await mkdtemp(path.join(os.tmpdir(), 'plugin-mcp-reader-'));
  });
  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it('reads each plugin .mcp.json into read-only servers', async () => {
    const dir = path.join(tmp, 'serena');
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, '.mcp.json'),
      JSON.stringify({ mcpServers: { serena: { command: 'serena-mcp' } } }),
      'utf8',
    );
    const roots: PluginRoot[] = [{ pluginId: 'serena' as never, dir, provenance: 'claude-code' }];

    const reader = new PluginMcpReader({ listRoots: async () => roots });
    const servers = await reader.read('personal');

    expect(servers).toHaveLength(1);
    expect(servers[0]?.name).toBe('serena');
    expect(servers[0]?.location).toEqual({ kind: 'plugin', pluginId: 'serena', pluginDir: dir });
    expect(servers[0]?.provenance).toBe('claude-code');
  });

  it('skips plugins without a .mcp.json', async () => {
    const dir = path.join(tmp, 'noop');
    await mkdir(dir, { recursive: true });
    const reader = new PluginMcpReader({
      listRoots: async () => [{ pluginId: 'noop' as never, dir, provenance: 'workspace-managed' }],
    });
    expect(await reader.read('personal')).toEqual([]);
  });
});
