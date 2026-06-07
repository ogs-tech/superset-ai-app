import fs from 'node:fs/promises';
import path from 'node:path';
import lockfile from 'proper-lockfile';
import type { McpConfigPort, McpReadOptions, RawMcpServer } from '../../application/ports/mcp-config-port.js';
import type { McpLocation } from '../../domain/mcp-location.js';
import { mcpServerDefSchema, type McpServerDef } from '../../application/schemas/mcp.js';

export interface FsMcpConfigStorePaths {
  claudeJsonPath: string;
}

interface ClaudeJsonShape {
  mcpServers?: Record<string, unknown>;
  projects?: Record<string, { mcpServers?: Record<string, unknown> } | undefined>;
}

function parseDef(raw: unknown): McpServerDef | undefined {
  const result = mcpServerDefSchema.safeParse(raw);
  return result.success ? result.data : undefined;
}

export class FsMcpConfigStore implements McpConfigPort {
  constructor(private readonly paths: FsMcpConfigStorePaths) {}

  async read(options: McpReadOptions): Promise<RawMcpServer[]> {
    const out: RawMcpServer[] = [];
    const root = await this.readClaudeJson();

    for (const [name, raw] of Object.entries(root.mcpServers ?? {})) {
      const def = parseDef(raw);
      if (def) out.push({ location: { kind: 'global' }, name, def, enabled: true });
    }

    for (const [repoPath, block] of Object.entries(root.projects ?? {})) {
      for (const [name, raw] of Object.entries(block?.mcpServers ?? {})) {
        const def = parseDef(raw);
        if (def) {
          out.push({ location: { kind: 'project-local', repoPath }, name, def, enabled: true });
        }
      }
    }

    for (const repoPath of options.repoPaths) {
      const shared = await this.readMcpJson(path.join(repoPath, '.mcp.json'));
      for (const [name, raw] of Object.entries(shared)) {
        const def = parseDef(raw);
        if (def) {
          out.push({ location: { kind: 'project-shared', repoPath }, name, def, enabled: true });
        }
      }
    }

    return out;
  }

  async upsert(location: McpLocation, name: string, def: McpServerDef): Promise<void> {
    if (location.kind === 'plugin') throw new Error('Cannot write a plugin MCP server');
    if (location.kind === 'project-shared') {
      await this.mutateMcpJson(path.join(location.repoPath, '.mcp.json'), (servers) => {
        servers[name] = def;
      });
      return;
    }
    await this.mutateClaudeJson((root) => {
      setServer(root, location, name, def);
    });
  }

  async remove(location: McpLocation, name: string): Promise<void> {
    if (location.kind === 'plugin') throw new Error('Cannot write a plugin MCP server');
    if (location.kind === 'project-shared') {
      await this.mutateMcpJson(path.join(location.repoPath, '.mcp.json'), (servers) => {
        delete servers[name];
      });
      return;
    }
    await this.mutateClaudeJson((root) => {
      deleteServer(root, location, name);
    });
  }

  private async mutateClaudeJson(mutate: (root: Record<string, unknown>) => void): Promise<void> {
    const filePath = this.paths.claudeJsonPath;
    await ensureFile(filePath);
    const release = await acquire(filePath);
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const root = JSON.parse(raw) as Record<string, unknown>; // throws on bad JSON → abort
      await fs.writeFile(filePath + '.bak', raw, 'utf8');
      mutate(root);
      await atomicWrite(filePath, JSON.stringify(root, null, 2));
    } finally {
      await release();
    }
  }

  private async mutateMcpJson(
    filePath: string,
    mutate: (servers: Record<string, unknown>) => void,
  ): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await ensureFile(filePath);
    const release = await acquire(filePath);
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const root = JSON.parse(raw) as { mcpServers?: Record<string, unknown> };
      await fs.writeFile(filePath + '.bak', raw, 'utf8');
      const servers = root.mcpServers ?? {};
      mutate(servers);
      root.mcpServers = servers;
      await atomicWrite(filePath, JSON.stringify(root, null, 2));
    } finally {
      await release();
    }
  }

  private async readClaudeJson(): Promise<ClaudeJsonShape> {
    const raw = await fs.readFile(this.paths.claudeJsonPath, 'utf8').catch((err: unknown) => {
      if (isNotFound(err)) return undefined;
      throw err;
    });
    if (raw === undefined) return {};
    try {
      return JSON.parse(raw) as ClaudeJsonShape;
    } catch {
      return {};
    }
  }

  private async readMcpJson(file: string): Promise<Record<string, unknown>> {
    const raw = await fs.readFile(file, 'utf8').catch((err: unknown) => {
      if (isNotFound(err)) return undefined;
      throw err;
    });
    if (raw === undefined) return {};
    try {
      const json = JSON.parse(raw) as { mcpServers?: Record<string, unknown> };
      return json.mcpServers ?? {};
    } catch {
      return {};
    }
  }
}

function isNotFound(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 'ENOENT'
  );
}

function setServer(
  root: Record<string, unknown>,
  location: Extract<McpLocation, { kind: 'global' | 'project-local' }>,
  name: string,
  def: McpServerDef,
): void {
  if (location.kind === 'global') {
    const servers = (root.mcpServers as Record<string, unknown>) ?? {};
    servers[name] = def;
    root.mcpServers = servers;
    return;
  }
  const projects = (root.projects as Record<string, Record<string, unknown>>) ?? {};
  const block = projects[location.repoPath] ?? {};
  const servers = (block.mcpServers as Record<string, unknown>) ?? {};
  servers[name] = def;
  block.mcpServers = servers;
  projects[location.repoPath] = block;
  root.projects = projects;
}

function deleteServer(
  root: Record<string, unknown>,
  location: Extract<McpLocation, { kind: 'global' | 'project-local' }>,
  name: string,
): void {
  if (location.kind === 'global') {
    const servers = root.mcpServers as Record<string, unknown> | undefined;
    if (servers) delete servers[name];
    return;
  }
  const projects = root.projects as Record<string, Record<string, unknown>> | undefined;
  const servers = projects?.[location.repoPath]?.mcpServers as Record<string, unknown> | undefined;
  if (servers) delete servers[name];
}

async function ensureFile(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, '{}', 'utf8');
  }
}

async function acquire(filePath: string): Promise<() => Promise<void>> {
  return lockfile.lock(filePath, { retries: { retries: 5, minTimeout: 100 }, stale: 10000 });
}

async function atomicWrite(filePath: string, content: string): Promise<void> {
  const tmpPath = filePath + '.tmp';
  await fs.writeFile(tmpPath, content, 'utf8');
  await fs.rename(tmpPath, filePath);
}
