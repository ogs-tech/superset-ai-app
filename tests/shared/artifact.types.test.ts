import { describe, expect, it } from 'vitest';
import type {
  ArtifactFrontmatter,
  ArtifactScope,
  ArtifactType,
} from '../../src/shared/artifact.js';

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

describe('ArtifactType union (spec 014)', () => {
  it('includes "global-instruction"', () => {
    const value: ArtifactType = 'global-instruction';
    expect(value).toBe('global-instruction');
  });

  it('accepts "global-instruction" in ArtifactFrontmatter.type', () => {
    const fm = {
      name: 'claude',
      type: 'global-instruction',
      description: 'desc',
      scopes: ['personal'] as ArtifactScope[],
      version: '1.0.0',
      createdAt: '',
      updatedAt: '',
    } satisfies ArtifactFrontmatter;

    expect(fm.type).toBe('global-instruction');
  });
});
