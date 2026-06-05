/** A single MCP server entry read from ~/.claude.json. */
export interface McpServerConfig {
  name: string;
  source: 'global' | 'project';
  projectPath?: string;
}

/** A server flagged in ~/.claude/mcp-needs-auth-cache.json. */
export interface McpAuthAlert {
  name: string;
}

export type McpLogState = 'ok' | 'warning' | 'error';

/** Classified summary of the newest log session for one MCP server. */
export interface McpLogSummary {
  server: string;
  state: McpLogState;
  detail?: string;
  sessionId?: string;
}

/**
 * Reads Claude Code runtime files the app does NOT own. Every read tolerates a
 * missing file (ENOENT) by returning an empty result, never throwing.
 */
export interface ClaudeRuntimePort {
  readMcpServers(): Promise<McpServerConfig[]>;
  readMcpAuthAlerts(): Promise<McpAuthAlert[]>;
  readMcpRuntimeLogs(): Promise<McpLogSummary[]>;
}
