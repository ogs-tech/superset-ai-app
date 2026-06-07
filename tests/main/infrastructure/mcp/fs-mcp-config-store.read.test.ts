import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FsMcpConfigStore } from '../../../../src/main/infrastructure/mcp/fs-mcp-config-store.js';

describe('FsMcpConfigStore.read', () => {
  let tmp: string;
  let claudeJsonPath: string;

  beforeEach(async () => {
    tmp = await mkdtemp(path.join(os.tmpdir(), 'mcp-store-read-'));
    claudeJsonPath = path.join(tmp, '.claude.json');
  });
  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it('returns [] when ~/.claude.json is missing', async () => {
    const store = new FsMcpConfigStore({ claudeJsonPath });
    expect(await store.read({ repoPaths: [] })).toEqual([]);
  });

  it('reads global + project-local servers and a repo .mcp.json (project-shared)', async () => {
    const repoPath = path.join(tmp, 'repo');
    await mkdir(repoPath, { recursive: true });
    await writeFile(
      claudeJsonPath,
      JSON.stringify({
        numStartups: 7,
        mcpServers: { pencil: { command: 'pencil-mcp' } },
        projects: {
          [repoPath]: { mcpServers: { clickup: { type: 'http', url: 'https://c.dev' } } },
        },
      }),
      'utf8',
    );
    await writeFile(
      path.join(repoPath, '.mcp.json'),
      JSON.stringify({ mcpServers: { figma: { type: 'sse', url: 'https://f.dev' } } }),
      'utf8',
    );

    const store = new FsMcpConfigStore({ claudeJsonPath });
    const servers = await store.read({ repoPaths: [repoPath] });

    const byName = Object.fromEntries(servers.map((s) => [s.name, s]));
    expect(byName['pencil']?.location).toEqual({ kind: 'global' });
    expect(byName['clickup']?.location).toEqual({ kind: 'project-local', repoPath });
    expect(byName['figma']?.location).toEqual({ kind: 'project-shared', repoPath });
    expect(servers.every((s) => s.enabled)).toBe(true);
  });

  it('skips malformed server defs without throwing', async () => {
    await writeFile(
      claudeJsonPath,
      JSON.stringify({ mcpServers: { good: { command: 'x' }, bad: { nope: true } } }),
      'utf8',
    );
    const store = new FsMcpConfigStore({ claudeJsonPath });
    const servers = await store.read({ repoPaths: [] });
    expect(servers.map((s) => s.name)).toEqual(['good']);
  });

  it('returns [] when ~/.claude.json is malformed JSON', async () => {
    await writeFile(claudeJsonPath, '{ broken', 'utf8');
    const store = new FsMcpConfigStore({ claudeJsonPath });
    await expect(store.read({ repoPaths: [] })).resolves.toEqual([]);
  });

  it('skips a repo whose .mcp.json is malformed JSON, still reads claude.json globals', async () => {
    const repoPath = path.join(tmp, 'repo');
    await mkdir(repoPath, { recursive: true });
    await writeFile(
      claudeJsonPath,
      JSON.stringify({ mcpServers: { global: { command: 'global-mcp' } } }),
      'utf8',
    );
    await writeFile(path.join(repoPath, '.mcp.json'), '{ broken', 'utf8');

    const store = new FsMcpConfigStore({ claudeJsonPath });
    const servers = await store.read({ repoPaths: [repoPath] });
    expect(servers).toHaveLength(1);
    expect(servers[0]?.name).toBe('global');
    expect(servers[0]?.location).toEqual({ kind: 'global' });
  });
});
