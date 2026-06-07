import type { McpLocation } from './mcp-location.js';
import { McpServerIdInvalidError } from './mcp-errors.js';

export interface McpServerRef {
  location: McpLocation;
  name: string;
}

const KINDS = new Set(['global', 'project-local', 'project-shared', 'plugin', 'detected']);

export function mcpServerId(ref: McpServerRef): string {
  return Buffer.from(JSON.stringify(ref), 'utf8').toString('base64url');
}

export function parseMcpServerId(id: string): McpServerRef {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(id, 'base64url').toString('utf8'));
  } catch {
    throw new McpServerIdInvalidError(`Invalid MCP server id: '${id}'`, { raw: id });
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as { name?: unknown }).name !== 'string' ||
    typeof (parsed as { location?: unknown }).location !== 'object' ||
    (parsed as { location: { kind?: unknown } }).location === null ||
    !KINDS.has(String((parsed as { location: { kind?: unknown } }).location.kind))
  ) {
    throw new McpServerIdInvalidError(`Invalid MCP server id payload: '${id}'`, { raw: id });
  }
  return parsed as McpServerRef;
}
