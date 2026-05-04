import type { ArtifactScope } from '../../../shared/artifact.js';
import type { TemplateFrontmatter, TemplateTargetType } from '../../../shared/template.js';

const VALID_SCOPES: readonly ArtifactScope[] = ['personal', 'project'];
const VALID_TARGET_TYPES: readonly TemplateTargetType[] = [
  'skill',
  'reference',
  'agent',
  'global-instruction',
];

const isArtifactScope = (value: unknown): value is ArtifactScope =>
  typeof value === 'string' && (VALID_SCOPES as readonly string[]).includes(value);

const isTargetType = (value: unknown): value is TemplateTargetType =>
  typeof value === 'string' && (VALID_TARGET_TYPES as readonly string[]).includes(value);

export function normalizeTemplateFrontmatter(raw: unknown): TemplateFrontmatter {
  const fm = { ...(raw as Record<string, unknown>) };

  if (Array.isArray(fm.scopes)) {
    fm.scopes = fm.scopes.filter(isArtifactScope);
  } else if (isArtifactScope(fm.scope)) {
    fm.scopes = [fm.scope];
  } else {
    fm.scopes = [];
  }

  if (!isTargetType(fm.targetType) && isTargetType(fm.type)) {
    fm.targetType = fm.type;
  }

  delete fm.scope;
  delete fm.slug;
  delete fm.type;
  return fm as unknown as TemplateFrontmatter;
}
