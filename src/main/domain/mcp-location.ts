/** Identifies exactly where an MCP server definition physically lives. */
export type McpLocation =
  | { kind: 'global' }
  | { kind: 'project-local'; repoPath: string }
  | { kind: 'project-shared'; repoPath: string }
  | { kind: 'plugin'; pluginId: string; pluginDir: string };

export type McpScope = McpLocation['kind'];

export function locationScope(loc: McpLocation): McpScope {
  return loc.kind;
}

export function locationRepoPath(loc: McpLocation): string | undefined {
  return loc.kind === 'project-local' || loc.kind === 'project-shared'
    ? loc.repoPath
    : undefined;
}
