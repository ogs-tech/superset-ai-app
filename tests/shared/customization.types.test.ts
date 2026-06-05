import { describe, expect, it } from 'vitest';
import type {
  CustomizationFrontmatter,
  CustomizationScope,
  CustomizationType,
} from '../../src/shared/customization.js';

describe('CustomizationFrontmatter.scopes (multi-scope contract)', () => {
  it('accepts an array of scopes', () => {
    const fm = {
      name: 'foo',
      type: 'skill',
      description: 'desc',
      scopes: ['personal', 'project'] as CustomizationScope[],
      version: '1.0.0',
      createdAt: '',
      updatedAt: '',
    } satisfies CustomizationFrontmatter;

    expect(fm.scopes).toEqual(['personal', 'project']);
  });

  it('accepts a single-scope array', () => {
    const fm = {
      name: 'bar',
      type: 'skill',
      description: 'desc',
      scopes: ['personal'] as CustomizationScope[],
      version: '1.0.0',
      createdAt: '',
      updatedAt: '',
    } satisfies CustomizationFrontmatter;

    expect(fm.scopes).toHaveLength(1);
  });
});

describe('CustomizationType union (spec 014)', () => {
  it('includes "global-instruction"', () => {
    const value: CustomizationType = 'global-instruction';
    expect(value).toBe('global-instruction');
  });

  it('accepts "global-instruction" in CustomizationFrontmatter.type', () => {
    const fm = {
      name: 'claude',
      type: 'global-instruction',
      description: 'desc',
      scopes: ['personal'] as CustomizationScope[],
      version: '1.0.0',
      createdAt: '',
      updatedAt: '',
    } satisfies CustomizationFrontmatter;

    expect(fm.type).toBe('global-instruction');
  });
});

describe('CustomizationType excludes "template"', () => {
  it('does not include "template"', () => {
    const valid: CustomizationType[] = ['skill', 'agent', 'global-instruction', 'command'];
    expect(valid).toHaveLength(4);
  });
});
