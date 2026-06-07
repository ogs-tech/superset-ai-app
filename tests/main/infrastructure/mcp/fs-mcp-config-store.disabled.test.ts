import { mkdtemp, rm, writeFile, readFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FsMcpConfigStore } from '../../../../src/main/infrastructure/mcp/fs-mcp-config-store.js';

describe('FsMcpConfigStore disabled list (project-shared)', () => {
  let tmp: string;
  let claudeJsonPath: string;
  let repoPath: string;
  beforeEach(async () => {
    tmp = await mkdtemp(path.join(os.tmpdir(), 'mcp-store-disabled-'));
    claudeJsonPath = path.join(tmp, '.claude.json');
    repoPath = path.join(tmp, 'repo');
    await mkdir(repoPath, { recursive: true });
    await writeFile(path.join(repoPath, '.mcp.json'), JSON.stringify({ mcpServers: { figma: { type: 'sse', url: 'https://f.dev' } } }), 'utf8');
  });
  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it('setDisabledShared adds the name to projects[repoPath].disabledMcpjsonServers', async () => {
    await writeFile(claudeJsonPath, JSON.stringify({ projects: { [repoPath]: {} } }), 'utf8');
    const store = new FsMcpConfigStore({ claudeJsonPath });
    await store.setDisabledShared(repoPath, 'figma', true);
    const json = JSON.parse(await readFile(claudeJsonPath, 'utf8'));
    expect(json.projects[repoPath].disabledMcpjsonServers).toEqual(['figma']);

    await store.setDisabledShared(repoPath, 'figma', false);
    const json2 = JSON.parse(await readFile(claudeJsonPath, 'utf8'));
    expect(json2.projects[repoPath].disabledMcpjsonServers).toEqual([]);
  });

  it('read marks a project-shared server disabled when in the disabled list', async () => {
    await writeFile(claudeJsonPath, JSON.stringify({ projects: { [repoPath]: { disabledMcpjsonServers: ['figma'] } } }), 'utf8');
    const store = new FsMcpConfigStore({ claudeJsonPath });
    const servers = await store.read({ repoPaths: [repoPath] });
    expect(servers.find((s) => s.name === 'figma')?.enabled).toBe(false);
  });
});
