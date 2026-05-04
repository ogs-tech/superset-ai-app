import { describe, it, expect } from 'vitest';
import { SchemaValidator } from '../../../../../src/main/application/services/schema-validator.js';
import type { CustomizationFrontmatter } from '../../../../../src/shared/customization.js';

const validBase: CustomizationFrontmatter = {
  name: 'my-skill',
  type: 'skill',
  description: 'A valid skill',
  scopes: ['personal'],
  version: '1.0.0',
  createdAt: '2026-05-03T00:00:00.000Z',
  updatedAt: '2026-05-03T00:00:00.000Z',
};

describe('SchemaValidator — scopes (AC#8)', () => {
  it('scopes: [] → kind "min-items"', () => {
    const result = new SchemaValidator().validate({ ...validBase, scopes: [] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const err = result.errors.find((e) => e.path === 'frontmatter.scopes');
    expect(err).toBeDefined();
    expect(err?.kind).toBe('min-items');
  });

  it('scopes: ["personal","personal"] → kind "unique"', () => {
    const result = new SchemaValidator().validate({ ...validBase, scopes: ['personal', 'personal'] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const err = result.errors.find((e) => e.path === 'frontmatter.scopes');
    expect(err).toBeDefined();
    expect(err?.kind).toBe('unique');
  });

  it('scopes: ["invalid"] → kind "enum"', () => {
    const result = new SchemaValidator().validate({ ...validBase, scopes: ['invalid' as 'personal'] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.kind === 'enum')).toBe(true);
  });
});
