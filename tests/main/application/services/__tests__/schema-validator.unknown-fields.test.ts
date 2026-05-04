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

describe('SchemaValidator — unknown fields (AC#13)', () => {
  it('valid frontmatter with unknown field "author" → ok: true (lax)', () => {
    const withExtra = { ...validBase, author: 'me' } as CustomizationFrontmatter;
    const result = new SchemaValidator().validate(withExtra);
    expect(result.ok).toBe(true);
  });
});
