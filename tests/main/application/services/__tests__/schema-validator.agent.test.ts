import { describe, it, expect } from 'vitest';
import { SchemaValidator } from '../../../../../src/main/application/services/schema-validator.js';
import type { ArtifactFrontmatter } from '../../../../../src/shared/artifact.js';

const validAgent: ArtifactFrontmatter = {
  name: 'my-agent',
  type: 'agent',
  description: 'A valid agent',
  scopes: ['personal'],
  version: '1.0.0',
  createdAt: '2026-05-03T00:00:00.000Z',
  updatedAt: '2026-05-03T00:00:00.000Z',
};

describe('SchemaValidator — agent (AC#3, AC#4)', () => {
  it('valid agent frontmatter → ok: true', () => {
    const result = new SchemaValidator().validate(validAgent);
    expect(result.ok).toBe(true);
  });
});
