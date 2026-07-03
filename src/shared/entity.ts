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

export type InstructionActivation = 'always' | 'glob' | 'agent-requested' | 'manual';

export interface Instruction extends Entity {
  kind: 'instruction';
  content: string;
  activation: InstructionActivation;
  globs?: string[];
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
