import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  ClaudeRuntimePort,
  McpServerConfig,
  McpAuthAlert,
  McpLogState,
  McpLogSummary,
} from '../../application/ports/claude-runtime-port.js';
import {
  classifyMcpLog,
  type McpLogLine,
} from '../../application/services/health/mcp-log-classifier.js';

export interface FsClaudeRuntimeReaderPaths {
  claudeJsonPath: string;
  authCachePath: string;
  mcpLogsBaseDir: string;
}

const RANK: Record<McpLogState, number> = { ok: 0, warning: 1, error: 2 };

function isNotFound(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 'ENOENT'
  );
}

async function readJson(path: string): Promise<unknown | undefined> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as unknown;
  } catch (err) {
    if (isNotFound(err)) return undefined;
    throw err;
  }
}

async function safeReaddir(path: string): Promise<string[]> {
  try {
    return await readdir(path);
  } catch (err) {
    if (isNotFound(err)) return [];
    throw err;
  }
}

function parseJsonl(raw: string): McpLogLine[] {
  const lines: McpLogLine[] = [];
  for (const text of raw.split('\n')) {
    const trimmed = text.trim();
    if (trimmed.length === 0) continue;
    try {
      lines.push(JSON.parse(trimmed) as McpLogLine);
    } catch {
      // Skip malformed lines — partial flushes happen.
    }
  }
  return lines;
}

export class FsClaudeRuntimeReader implements ClaudeRuntimePort {
  constructor(private readonly paths: FsClaudeRuntimeReaderPaths) {}

  async readMcpServers(): Promise<McpServerConfig[]> {
    const json = await readJson(this.paths.claudeJsonPath);
    const root = json as { mcpServers?: Record<string, unknown> } | undefined;
    const servers = root?.mcpServers;
    if (servers === undefined || servers === null) return [];
    return Object.keys(servers).map((name) => ({ name, source: 'global' as const }));
  }

  async readMcpAuthAlerts(): Promise<McpAuthAlert[]> {
    const json = await readJson(this.paths.authCachePath);
    if (json === undefined || json === null) return [];
    const names = Array.isArray(json)
      ? json.filter((n): n is string => typeof n === 'string')
      : typeof json === 'object'
        ? Object.keys(json as Record<string, unknown>)
        : [];
    return names.map((name) => ({ name }));
  }

  async readMcpRuntimeLogs(): Promise<McpLogSummary[]> {
    const projects = await safeReaddir(this.paths.mcpLogsBaseDir);
    const byServer = new Map<string, McpLogSummary>();

    for (const projectSlug of projects) {
      const projectPath = join(this.paths.mcpLogsBaseDir, projectSlug);
      for (const entry of await safeReaddir(projectPath)) {
        const match = /^mcp-logs-(.+)$/.exec(entry);
        if (!match) continue;
        const server = match[1]!;
        const newest = await this.newestJsonl(join(projectPath, entry));
        if (newest === undefined) continue;

        const raw = await readFile(newest, 'utf8').catch(() => '');
        const result = classifyMcpLog(parseJsonl(raw));
        const summary: McpLogSummary = {
          server,
          state: result.state,
          ...(result.detail !== undefined ? { detail: result.detail } : {}),
          ...(result.sessionId !== undefined ? { sessionId: result.sessionId } : {}),
        };

        const existing = byServer.get(server);
        if (existing === undefined || RANK[summary.state] > RANK[existing.state]) {
          byServer.set(server, summary);
        }
      }
    }

    return [...byServer.values()];
  }

  private async newestJsonl(logDir: string): Promise<string | undefined> {
    const files = (await safeReaddir(logDir)).filter((f) => f.endsWith('.jsonl'));
    let newest: string | undefined;
    let newestMtime = -Infinity;
    for (const file of files) {
      const full = join(logDir, file);
      try {
        const info = await stat(full);
        if (info.mtimeMs > newestMtime) {
          newestMtime = info.mtimeMs;
          newest = full;
        }
      } catch (err) {
        if (!isNotFound(err)) throw err;
      }
    }
    return newest;
  }
}
