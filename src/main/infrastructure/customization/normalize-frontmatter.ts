import type { CustomizationFrontmatter, CustomizationScope } from '../../../shared/customization.js';

const VALID_SCOPES: readonly CustomizationScope[] = ['personal', 'project'];

const isCustomizationScope = (value: unknown): value is CustomizationScope =>
  typeof value === 'string' && (VALID_SCOPES as readonly string[]).includes(value);

export function normalizeCustomizationFrontmatter(raw: unknown): CustomizationFrontmatter {
  const fm = { ...(raw as Record<string, unknown>) };

  if (Array.isArray(fm.scopes)) {
    fm.scopes = fm.scopes.filter(isCustomizationScope);
  } else if (isCustomizationScope(fm.scope)) {
    fm.scopes = [fm.scope];
  } else {
    fm.scopes = [];
  }

  delete fm.scope;
  delete fm.slug;
  return fm as unknown as CustomizationFrontmatter;
}
