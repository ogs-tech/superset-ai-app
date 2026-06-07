import type { McpLocation } from '../../domain/mcp-location.js';
import type { McpServerDef } from '../schemas/mcp.js';

/** A server read from a real config file, with its physical location. */
export interface RawMcpServer {
  location: McpLocation;
  name: string;
  def: McpServerDef;
  /** False only when the server is parked in the disabled stash / disabled list. */
  enabled: boolean;
}

export interface McpReadOptions {
  /** Linked repo paths whose <repo>/.mcp.json should be read (project-shared). */
  repoPaths: string[];
}

/**
 * Reads and writes MCP servers in the real Claude config files. Reads tolerate
 * missing files. Writes are surgical, atomic, backed up, and fail-safe.
 * Never handles plugin servers (those are read-only; see PluginMcpReader).
 */
export interface McpConfigPort {
  read(options: McpReadOptions): Promise<RawMcpServer[]>;
  upsert(location: McpLocation, name: string, def: McpServerDef): Promise<void>;
  remove(location: McpLocation, name: string): Promise<void>;
}
