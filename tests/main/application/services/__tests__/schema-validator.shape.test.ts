import { describe, it, expect } from 'vitest';
import { SchemaValidator } from '../../../../../src/main/application/services/schema-validator.js';
import type { ArtifactFrontmatter } from '../../../../../src/shared/artifact.js';

const validSkill: ArtifactFrontmatter = {
  name: 'my-skill',
  type: 'skill',
  description: 'A valid skill',
  scopes: ['personal'],
  version: '1.0.0',
  createdAt: '2026-05-03T00:00:00.000Z',
  updatedAt: '2026-05-03T00:00:00.000Z',
};

const invalidSkill: ArtifactFrontmatter = {
  name: '',
  type: 'skill',
  description: '',
  scopes: [],
  version: 'bad',
  createdAt: 'not-a-date',
  updatedAt: 'not-a-date',
};

describe('SchemaValidator — shape (AC#1, AC#2)', () => {
  const validator = new SchemaValidator();

  it('validate(validFrontmatter) returns { ok: true }', () => {
    const result = validator.validate(validSkill);
    expect(result.ok).toBe(true);
  });

  it('validate(invalidFrontmatter) returns { ok: false, errors: ValidationError[] }', () => {
    const result = validator.validate(invalidSkill);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Array.isArray(result.errors)).toBe(true);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('each ValidationError has { path, kind, message }', () => {
    const result = validator.validate(invalidSkill);
    if (result.ok) return;
    for (const err of result.errors) {
      expect(typeof err.path).toBe('string');
      expect(typeof err.kind).toBe('string');
      expect(typeof err.message).toBe('string');
    }
  });
});
