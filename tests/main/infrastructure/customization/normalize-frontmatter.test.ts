import { describe, expect, it } from 'vitest';
import { normalizeCustomizationFrontmatter } from '../../../../src/main/infrastructure/customization/normalize-frontmatter.js';

describe('normalizeCustomizationFrontmatter — legacy scope migration', () => {
  it('converts legacy scope: "personal" into scopes: ["personal"]', () => {
    const legacy = {
      slug: 'foo',
      name: 'Foo',
      type: 'skill',
      description: 'desc',
      scope: 'personal',
      version: '1.0.0',
      createdAt: '',
      updatedAt: '',
    };

    const result = normalizeCustomizationFrontmatter(legacy);

    expect(result.scopes).toEqual(['personal']);
    expect((result as unknown as { scope?: string }).scope).toBeUndefined();
  });

  it('converts legacy scope: "project" into scopes: ["project"]', () => {
    const legacy = {
      slug: 'bar',
      name: 'Bar',
      type: 'agent',
      description: 'desc',
      scope: 'project',
      version: '1.0.0',
      createdAt: '',
      updatedAt: '',
    };

    const result = normalizeCustomizationFrontmatter(legacy);

    expect(result.scopes).toEqual(['project']);
  });

  it('preserves new-format scopes when already present', () => {
    const fresh = {
      slug: 'baz',
      name: 'Baz',
      type: 'skill',
      description: 'desc',
      scopes: ['personal', 'project'],
      version: '1.0.0',
      createdAt: '',
      updatedAt: '',
    };

    const result = normalizeCustomizationFrontmatter(fresh);

    expect(result.scopes).toEqual(['personal', 'project']);
  });

  it('prefers scopes when both legacy scope and scopes are present', () => {
    const both = {
      slug: 'qux',
      name: 'Qux',
      type: 'skill',
      description: 'desc',
      scope: 'personal',
      scopes: ['project'],
      version: '1.0.0',
      createdAt: '',
      updatedAt: '',
    };

    const result = normalizeCustomizationFrontmatter(both);

    expect(result.scopes).toEqual(['project']);
  });

  it('falls back to empty array when neither field is present', () => {
    const neither = {
      slug: 'orphan',
      name: 'Orphan',
      type: 'skill',
      description: 'desc',
      version: '1.0.0',
      createdAt: '',
      updatedAt: '',
    };

    const result = normalizeCustomizationFrontmatter(neither);

    expect(result.scopes).toEqual([]);
  });
});
