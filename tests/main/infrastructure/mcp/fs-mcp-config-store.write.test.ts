import { mkdtemp, rm, writeFile, readFile, stat, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FsMcpConfigStore } from '../../../../src/main/infrastructure/mcp/fs-mcp-config-store.js';

describe('FsMcpConfigStore write', () => {
  let tmp: string;
  let claudeJsonPath: string;
  beforeEach(async () => {
    tmp = await mkdtemp(path.join(os.tmpdir(), 'mcp-store-write-'));
    claudeJsonPath = path.join(tmp, '.claude.json');
  });
  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it('upserts a global server while preserving every sibling key', async () => {
    await writeFile(
      claudeJsonPath,
      JSON.stringify({ numStartups: 9, projects: { '/x': { foo: 1 } }, mcpServers: { old: { command: 'o' } } }),
      'utf8',
    );
    const store = new FsMcpConfigStore({ claudeJsonPath });
    await store.upsert({ kind: 'global' }, 'pencil', { command: 'pencil-mcp' });

    const json = JSON.parse(await readFile(claudeJsonPath, 'utf8'));
    expect(json.numStartups).toBe(9);
    expect(json.projects).toEqual({ '/x': { foo: 1 } });
    expect(json.mcpServers.old).toEqual({ command: 'o' });
    expect(json.mcpServers.pencil).toEqual({ command: 'pencil-mcp' });
  });

  it('writes a .bak and cleans up the .tmp', async () => {
    await writeFile(claudeJsonPath, JSON.stringify({ a: 1 }), 'utf8');
    const store = new FsMcpConfigStore({ claudeJsonPath });
    await store.upsert({ kind: 'global' }, 'pencil', { command: 'x' });
    expect(await readFile(claudeJsonPath + '.bak', 'utf8')).toBe(JSON.stringify({ a: 1 }));
    await expect(stat(claudeJsonPath + '.tmp')).rejects.toThrow();
  });

  it('upserts a project-local server under projects[repoPath].mcpServers', async () => {
    await writeFile(claudeJsonPath, JSON.stringify({ projects: { '/repo': { history: [] } } }), 'utf8');
    const store = new FsMcpConfigStore({ claudeJsonPath });
    await store.upsert({ kind: 'project-local', repoPath: '/repo' }, 'clickup', { type: 'http', url: 'https://c.dev' });
    const json = JSON.parse(await readFile(claudeJsonPath, 'utf8'));
    expect(json.projects['/repo'].history).toEqual([]);
    expect(json.projects['/repo'].mcpServers.clickup).toEqual({ type: 'http', url: 'https://c.dev' });
  });

  it('upserts a project-shared server into <repo>/.mcp.json', async () => {
    const repoPath = path.join(tmp, 'repo');
    await mkdir(repoPath, { recursive: true });
    const store = new FsMcpConfigStore({ claudeJsonPath });
    await store.upsert({ kind: 'project-shared', repoPath }, 'figma', { type: 'sse', url: 'https://f.dev' });
    const json = JSON.parse(await readFile(path.join(repoPath, '.mcp.json'), 'utf8'));
    expect(json.mcpServers.figma).toEqual({ type: 'sse', url: 'https://f.dev' });
  });

  it('removes a server', async () => {
    await writeFile(claudeJsonPath, JSON.stringify({ mcpServers: { a: { command: 'a' }, b: { command: 'b' } } }), 'utf8');
    const store = new FsMcpConfigStore({ claudeJsonPath });
    await store.remove({ kind: 'global' }, 'a');
    const json = JSON.parse(await readFile(claudeJsonPath, 'utf8'));
    expect(json.mcpServers).toEqual({ b: { command: 'b' } });
  });

  it('aborts (throws) when ~/.claude.json is not valid JSON, leaving it untouched', async () => {
    await writeFile(claudeJsonPath, '{ broken', 'utf8');
    const store = new FsMcpConfigStore({ claudeJsonPath });
    await expect(store.upsert({ kind: 'global' }, 'x', { command: 'x' })).rejects.toThrow();
    expect(await readFile(claudeJsonPath, 'utf8')).toBe('{ broken');
  });

  it('aborts upsert when mcpServers is present but not an object, leaving the file untouched', async () => {
    const original = JSON.stringify({ mcpServers: 'oops', numStartups: 5 });
    await writeFile(claudeJsonPath, original, 'utf8');
    const store = new FsMcpConfigStore({ claudeJsonPath });
    await expect(store.upsert({ kind: 'global' }, 'x', { command: 'x' })).rejects.toThrow();
    expect(await readFile(claudeJsonPath, 'utf8')).toBe(original);
  });
});
