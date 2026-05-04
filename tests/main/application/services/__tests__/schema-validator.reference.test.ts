import { describe, it, expect } from 'vitest';
import { SchemaValidator } from '../../../../../src/main/application/services/schema-validator.js';
import type { ArtifactFrontmatter } from '../../../../../src/shared/artifact.js';

const validRef: ArtifactFrontmatter = {
  name: 'my-ref',
  type: 'reference',
  description: 'A valid reference',
  scopes: ['personal'],
  version: '1.0.0',
  createdAt: '2026-05-03T00:00:00.000Z',
  updatedAt: '2026-05-03T00:00:00.000Z',
};

describe('SchemaValidator — reference', () => {
  it('valid reference → ok: true', () => {
    const result = new SchemaValidator().validate(validRef);
    expect(result.ok).toBe(true);
  });
});
