import fs from 'node:fs/promises';
import path from 'node:path';
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

  async upsert(_location: McpLocation, _name: string, _def: McpServerDef): Promise<void> {
    throw new Error('not implemented (Phase 2)');
  }

  async remove(_location: McpLocation, _name: string): Promise<void> {
    throw new Error('not implemented (Phase 2)');
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
