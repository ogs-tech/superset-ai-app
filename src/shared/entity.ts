export type EntityKind = 'skill' | 'agent' | 'mcp' | 'instruction' | 'hook';

export type Scope = 'personal' | 'project';

export type EntityProvenance = 'workspace-managed' | 'claude-code';

export type EntitySource =
  | { kind: 'workspace' }
  | { kind: 'plugin'; pluginId: string; provenance: EntityProvenance };

export const WORKSPACE_SOURCE: EntitySource = { kind: 'workspace' };

export function isPluginSource(
  source: EntitySource,
): source is { kind: 'plugin'; pluginId: string; provenance: EntityProvenance } {
  return source.kind === 'plugin';
}

export function isWorkspaceSource(source: EntitySource): source is { kind: 'workspace' } {
  return source.kind === 'workspace';
}

export interface EntityMetadata {
  version: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Entity {
  urn: string;
  kind: EntityKind;
  name: string;
  description: string;
  scopes: Scope[];
  metadata: EntityMetadata;
  source: EntitySource;
  ext?: Record<string, unknown>;
}

export interface Skill extends Entity {
  kind: 'skill';
  content: string;
  explicitOnly?: boolean;
}

export interface Agent extends Entity {
  kind: 'agent';
  systemPrompt: string;
  model?: string;
  tools?: string[];
  deniedTools?: string[];
}

// The Personal instruction is a singleton (name === 'default', scopes === ['personal']).
// A Project instruction is created per-repo — the entity itself carries the
// absolute path of the repo it belongs to via `repoPath`.
export interface PersonalInstruction extends Entity {
  kind: 'instruction';
  name: 'default';
  scopes: ['personal'];
  content: string;
}

export interface ProjectInstruction extends Entity {
  kind: 'instruction';
  scopes: ['project'];
  content: string;
  repoPath: string;
}

export type Instruction = PersonalInstruction | ProjectInstruction;

export function isPersonalInstruction(entity: Instruction): entity is PersonalInstruction {
  return entity.scopes[0] === 'personal';
}

export function isProjectInstruction(entity: Instruction): entity is ProjectInstruction {
  return entity.scopes[0] === 'project';
}

/**
 * Sidecar metadata for instructions. Instructions are stored frontmatter-free
 * on disk so the sync target (AGENTS.md, CLAUDE.md) is a clean body — this
 * struct captures everything else (description, version, timestamps, and the
 * per-project repoPath) and lives in a separate `meta.json` for project
 * instructions. Personal instructions default this struct in memory.
 */
export interface InstructionSidecar {
  description: string;
  version: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  repoPath?: string;
}

export function entityUrn(kind: EntityKind, name: string): string {
  return `urn:${kind}:${name}`;
}

export function parseUrn(urn: string): { kind: EntityKind; name: string } {
  const match = /^urn:([a-z]+):(.+)$/.exec(urn);
  const kind = match?.[1];
  const name = match?.[2];
  if (kind === undefined || name === undefined) {
    throw new Error(`Invalid URN: ${urn}`);
  }
  return { kind: kind as EntityKind, name };
}
