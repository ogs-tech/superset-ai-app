import { describe, it, expect } from 'vitest';
import { SchemaValidator } from '../../../../../src/main/application/services/schema-validator.js';
import type { ArtifactFrontmatter } from '../../../../../src/shared/artifact.js';

const validGI: ArtifactFrontmatter = {
  name: 'default',
  type: 'global-instruction',
  description: 'A valid global instruction',
  scopes: ['personal'],
  version: '1.0.0',
  createdAt: '2026-05-03T00:00:00.000Z',
  updatedAt: '2026-05-03T00:00:00.000Z',
};

describe('SchemaValidator — global-instruction slug', () => {
  it('global-instruction with name "claude" → kind "enum" at frontmatter.name', () => {
    const result = new SchemaValidator().validate({ ...validGI, name: 'claude' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const err = result.errors.find((e) => e.path === 'frontmatter.name');
    expect(err).toBeDefined();
    expect(err?.kind).toBe('enum');
  });

  it('global-instruction with name "copilot" → kind "enum" at frontmatter.name', () => {
    const result = new SchemaValidator().validate({ ...validGI, name: 'copilot' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const err = result.errors.find((e) => e.path === 'frontmatter.name');
    expect(err).toBeDefined();
    expect(err?.kind).toBe('enum');
  });

  it('global-instruction with name "openai" → kind "enum" at frontmatter.name', () => {
    const result = new SchemaValidator().validate({ ...validGI, name: 'openai' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const err = result.errors.find((e) => e.path === 'frontmatter.name');
    expect(err).toBeDefined();
    expect(err?.kind).toBe('enum');
  });
});
