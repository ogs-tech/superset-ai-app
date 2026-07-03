import { parseMarkdown, serializeMarkdown } from '../markdown/frontmatter.js';
import { entityUrn } from '../../../shared/entity.js';
import type {
  Agent,
  Entity,
  EntityKind,
  EntityMetadata,
  EntitySource,
  Instruction,
  Scope,
  Skill,
} from '../../../shared/entity.js';

// Frontmatter keys the serializer maps to typed fields; everything else is `ext` passthrough.
const COMMON_KEYS = ['name', 'type', 'description', 'scopes', 'version', 'tags', 'createdAt', 'updatedAt'];
const SKILL_KEYS = [...COMMON_KEYS, 'disable-model-invocation'];
const AGENT_KEYS = [...COMMON_KEYS, 'model', 'tools', 'deniedTools'];

function extOf(frontmatter: Record<string, unknown>, known: string[]): Record<string, unknown> | undefined {
  const ext: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(frontmatter)) {
    if (!known.includes(k)) ext[k] = v;
  }
  return Object.keys(ext).length > 0 ? ext : undefined;
}

function metaFrontmatter(entity: Entity): Record<string, unknown> {
  return {
    name: entity.name,
    type: entity.kind,
    description: entity.description,
    scopes: entity.scopes,
    version: entity.metadata.version,
    ...(entity.metadata.tags !== undefined ? { tags: entity.metadata.tags } : {}),
    createdAt: entity.metadata.createdAt,
    updatedAt: entity.metadata.updatedAt,
  };
}

function readMetadata(fm: Record<string, unknown>): EntityMetadata {
  return {
    version: typeof fm['version'] === 'string' ? fm['version'] : '0.0.0',
    ...(Array.isArray(fm['tags']) ? { tags: fm['tags'] as string[] } : {}),
    createdAt: typeof fm['createdAt'] === 'string' ? fm['createdAt'] : '',
    updatedAt: typeof fm['updatedAt'] === 'string' ? fm['updatedAt'] : '',
  };
}

function readScopes(fm: Record<string, unknown>): Scope[] {
  const raw = fm['scopes'];
  if (Array.isArray(raw)) return raw.filter((s): s is Scope => s === 'personal' || s === 'project');
  return ['personal'];
}

export function renderEntityFile(entity: Entity): string {
  if (entity.kind === 'instruction') {
    // Frontmatter-free: the body is the whole file.
    const content = (entity as Instruction).content;
    return content.endsWith('\n') ? content : `${content}\n`;
  }
  if (entity.kind === 'skill') {
    const skill = entity as Skill;
    const fm: Record<string, unknown> = {
      ...metaFrontmatter(skill),
      ...(skill.explicitOnly ? { 'disable-model-invocation': true } : {}),
      ...(skill.ext ?? {}),
    };
    return serializeMarkdown(fm, skill.content);
  }
  if (entity.kind === 'agent') {
    const agent = entity as Agent;
    const fm: Record<string, unknown> = {
      ...metaFrontmatter(agent),
      ...(agent.model !== undefined ? { model: agent.model } : {}),
      ...(agent.tools !== undefined ? { tools: agent.tools } : {}),
      ...(agent.deniedTools !== undefined ? { deniedTools: agent.deniedTools } : {}),
      ...(agent.ext ?? {}),
    };
    return serializeMarkdown(fm, agent.systemPrompt);
  }
  // mcp / hook are not .md-backed; Phase 1.
  throw new Error(`renderEntityFile: unsupported kind '${entity.kind}'`);
}

export function parseEntityFile(args: {
  kind: EntityKind;
  name: string;
  raw: string;
  source: EntitySource;
}): Entity {
  const { kind, name, raw, source } = args;
  const { frontmatter, body } = parseMarkdown<Record<string, unknown>>(raw);

  const base = {
    urn: entityUrn(kind, name),
    kind,
    name,
    description: typeof frontmatter['description'] === 'string' ? frontmatter['description'] : '',
    scopes: readScopes(frontmatter),
    metadata: readMetadata(frontmatter),
    source,
  };

  if (kind === 'skill') {
    const skillExt = extOf(frontmatter, SKILL_KEYS);
    const skill: Skill = {
      ...base,
      kind: 'skill',
      content: body,
      ...(frontmatter['disable-model-invocation'] === true ? { explicitOnly: true } : {}),
      ...(skillExt !== undefined ? { ext: skillExt } : {}),
    };
    return skill;
  }
  if (kind === 'agent') {
    const agentExt = extOf(frontmatter, AGENT_KEYS);
    const agent: Agent = {
      ...base,
      kind: 'agent',
      systemPrompt: body,
      ...(typeof frontmatter['model'] === 'string' ? { model: frontmatter['model'] } : {}),
      ...(Array.isArray(frontmatter['tools']) ? { tools: frontmatter['tools'] as string[] } : {}),
      ...(Array.isArray(frontmatter['deniedTools']) ? { deniedTools: frontmatter['deniedTools'] as string[] } : {}),
      ...(agentExt !== undefined ? { ext: agentExt } : {}),
    };
    return agent;
  }
  if (kind === 'instruction') {
    // Frontmatter-free store; parseMarkdown strips any legacy frontmatter, keeping the body.
    const instruction: Instruction = {
      ...base,
      kind: 'instruction',
      description: '',
      scopes: ['personal'],
      metadata: { version: '0.0.0', createdAt: '', updatedAt: '' },
      content: body,
      activation: 'always',
    };
    return instruction;
  }
  throw new Error(`parseEntityFile: unsupported kind '${kind}'`);
}
