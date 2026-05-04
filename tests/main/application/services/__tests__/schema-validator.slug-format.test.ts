import { describe, it, expect } from 'vitest';
import { SchemaValidator } from '../../../../../src/main/application/services/schema-validator.js';
import type { ArtifactFrontmatter } from '../../../../../src/shared/artifact.js';

const validBase: ArtifactFrontmatter = {
  name: 'my-skill',
  type: 'skill',
  description: 'A valid skill',
  scopes: ['personal'],
  version: '1.0.0',
  createdAt: '2026-05-03T00:00:00.000Z',
  updatedAt: '2026-05-03T00:00:00.000Z',
};

describe('SchemaValidator — slug format (AC#6)', () => {
  it('name with spaces → kind "format" at frontmatter.name', () => {
    const result = new SchemaValidator().validate({ ...validBase, name: 'Invalid Slug' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const err = result.errors.find((e) => e.path === 'frontmatter.name');
    expect(err).toBeDefined();
    expect(err?.kind).toBe('format');
  });

  it('name with uppercase → kind "format" at frontmatter.name', () => {
    const result = new SchemaValidator().validate({ ...validBase, name: 'MySkill' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const err = result.errors.find((e) => e.path === 'frontmatter.name');
    expect(err?.kind).toBe('format');
  });
});
