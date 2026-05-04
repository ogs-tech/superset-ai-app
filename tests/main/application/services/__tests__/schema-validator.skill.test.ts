import { describe, it, expect } from 'vitest';
import { SchemaValidator } from '../../../../../src/main/application/services/schema-validator.js';
import type { ArtifactFrontmatter } from '../../../../../src/shared/artifact.js';

const validSkill: ArtifactFrontmatter = {
  name: 'my-skill',
  type: 'skill',
  description: 'A valid skill description',
  scopes: ['personal'],
  version: '1.0.0',
  createdAt: '2026-05-03T00:00:00.000Z',
  updatedAt: '2026-05-03T00:00:00.000Z',
};

describe('SchemaValidator — skill (AC#3, AC#4)', () => {
  it('valid complete skill frontmatter → ok: true', () => {
    const result = new SchemaValidator().validate(validSkill);
    expect(result.ok).toBe(true);
  });

  it('valid skill with optional tags → ok: true', () => {
    const result = new SchemaValidator().validate({ ...validSkill, tags: ['tag-a', 'tag-b'] } as ArtifactFrontmatter);
    expect(result.ok).toBe(true);
  });
});
