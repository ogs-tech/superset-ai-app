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

describe('Template artifact type', () => {
  it('includes "template" in ArtifactType', () => {
    const value: ArtifactType = 'template';
    expect(value).toBe('template');
  });

  it('accepts a template artifact frontmatter with targetType', () => {
    const fm = {
      name: 'my-skill-template',
      type: 'template',
      description: 'desc',
      scopes: ['personal'] as ArtifactScope[],
      version: '0.1.0',
      targetType: 'skill',
      createdAt: '',
      updatedAt: '',
    } satisfies ArtifactFrontmatter;

    expect(fm.type).toBe('template');
    expect(fm.targetType).toBe('skill');
  });
});
