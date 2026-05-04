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

const requiredFields: Array<keyof CustomizationFrontmatter> = [
  'name', 'type', 'description', 'scopes', 'version', 'createdAt', 'updatedAt',
];

describe('SchemaValidator — required fields (AC#5)', () => {
  for (const field of requiredFields) {
    it(`missing ${field} → error with kind "required" at frontmatter.${field}`, () => {
      const incomplete = { ...validBase } as Record<string, unknown>;
      delete incomplete[field];
      const result = new SchemaValidator().validate(incomplete as unknown as CustomizationFrontmatter);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      const err = result.errors.find((e) => e.path === `frontmatter.${field}`);
      expect(err).toBeDefined();
      expect(err?.kind).toBe('required');
    });
  }
});
