import type { ArtifactFrontmatter, ArtifactScope } from '../../../shared/artifact.js';

const VALID_SCOPES: readonly ArtifactScope[] = ['personal', 'project'];

const isArtifactScope = (value: unknown): value is ArtifactScope =>
  typeof value === 'string' && (VALID_SCOPES as readonly string[]).includes(value);

export function normalizeArtifactFrontmatter(raw: unknown): ArtifactFrontmatter {
  const fm = { ...(raw as Record<string, unknown>) };

  if (Array.isArray(fm.scopes)) {
    fm.scopes = fm.scopes.filter(isArtifactScope);
  } else if (isArtifactScope(fm.scope)) {
    fm.scopes = [fm.scope];
  } else {
    fm.scopes = [];
  }

  delete fm.scope;
  delete fm.slug;
  return fm as unknown as ArtifactFrontmatter;
}
