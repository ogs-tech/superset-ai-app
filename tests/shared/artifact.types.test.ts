import { describe, expect, it } from 'vitest';
import type { ArtifactFrontmatter, ArtifactScope } from '../../src/shared/artifact.js';

describe('ArtifactFrontmatter.scopes (multi-scope contract)', () => {
  it('accepts an array of scopes', () => {
    const fm = {
      name: 'foo',
      type: 'skill',
      description: 'desc',
      scopes: ['personal', 'project'] as ArtifactScope[],
      version: '1.0.0',
      createdAt: '',
      updatedAt: '',
    } satisfies ArtifactFrontmatter;

    expect(fm.scopes).toEqual(['personal', 'project']);
  });

  it('accepts a single-scope array', () => {
    const fm = {
      name: 'bar',
      type: 'skill',
      description: 'desc',
      scopes: ['personal'] as ArtifactScope[],
      version: '1.0.0',
      createdAt: '',
      updatedAt: '',
    } satisfies ArtifactFrontmatter;

    expect(fm.scopes).toHaveLength(1);
  });
});
