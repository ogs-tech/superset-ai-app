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

describe('SchemaValidator — version (AC#11)', () => {
  it('version "1.0" → kind "format" at frontmatter.version', () => {
    const result = new SchemaValidator().validate({ ...validBase, version: '1.0' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const err = result.errors.find((e) => e.path === 'frontmatter.version');
    expect(err).toBeDefined();
    expect(err?.kind).toBe('format');
  });

  it('version "1.2.3-rc.1" → ok: true', () => {
    const result = new SchemaValidator().validate({ ...validBase, version: '1.2.3-rc.1' });
    expect(result.ok).toBe(true);
  });
});
