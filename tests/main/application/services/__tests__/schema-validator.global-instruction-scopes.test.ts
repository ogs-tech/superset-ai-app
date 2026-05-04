import { describe, it, expect } from 'vitest';
import { SchemaValidator } from '../../../../../src/main/application/services/schema-validator.js';
import type { CustomizationFrontmatter } from '../../../../../src/shared/customization.js';

const validGI: CustomizationFrontmatter = {
  name: 'default',
  type: 'global-instruction',
  description: 'A valid global instruction',
  scopes: ['personal'],
  version: '1.0.0',
  createdAt: '2026-05-03T00:00:00.000Z',
  updatedAt: '2026-05-03T00:00:00.000Z',
};

describe('SchemaValidator — global-instruction scopes (AC#10)', () => {
  it('global-instruction with scopes ["personal","project"] → kind "enum" or "exact" at frontmatter.scopes', () => {
    const result = new SchemaValidator().validate({ ...validGI, scopes: ['personal', 'project'] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const err = result.errors.find((e) => e.path === 'frontmatter.scopes');
    expect(err).toBeDefined();
    expect(['enum', 'exact']).toContain(err?.kind);
  });

  it('global-instruction with scopes ["project"] → error at frontmatter.scopes or scopes[0]', () => {
    const result = new SchemaValidator().validate({ ...validGI, scopes: ['project'] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const err = result.errors.find(
      (e) => e.path === 'frontmatter.scopes' || e.path.startsWith('frontmatter.scopes['),
    );
    expect(err).toBeDefined();
  });
});
