import type { CustomizationScope } from '../../../shared/customization.js';
import type { TemplateFrontmatter, TemplateTargetType } from '../../../shared/template.js';

const VALID_SCOPES: readonly CustomizationScope[] = ['personal', 'project'];
const VALID_TARGET_TYPES: readonly TemplateTargetType[] = [
  'skill',
  'reference',
  'agent',
  'global-instruction',
];

const isCustomizationScope = (value: unknown): value is CustomizationScope =>
  typeof value === 'string' && (VALID_SCOPES as readonly string[]).includes(value);

const isTargetType = (value: unknown): value is TemplateTargetType =>
  typeof value === 'string' && (VALID_TARGET_TYPES as readonly string[]).includes(value);

export function normalizeTemplateFrontmatter(raw: unknown): TemplateFrontmatter {
  const fm = { ...(raw as Record<string, unknown>) };

  if (Array.isArray(fm.scopes)) {
    fm.scopes = fm.scopes.filter(isCustomizationScope);
  } else if (isCustomizationScope(fm.scope)) {
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
