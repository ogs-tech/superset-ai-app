import { describe, it, expect } from 'vitest';
import { SchemaValidator } from '../../../../../src/main/application/services/schema-validator.js';
import type {
  CustomizationFrontmatter,
  CustomizationType,
} from '../../../../../src/shared/customization.js';

const validBase = (type: CustomizationType): CustomizationFrontmatter => ({
  name: type === 'global-instruction' ? 'default' : 'my-customization',
  type,
  description: 'A valid description',
  scopes: ['personal'],
  version: '1.0.0',
  createdAt: '2026-05-03T00:00:00.000Z',
  updatedAt: '2026-05-03T00:00:00.000Z',
});

const types: CustomizationType[] = ['skill', 'agent', 'global-instruction', 'command'];

describe('SchemaValidator — description length (AC#7)', () => {
  it.each(types)('%s: description > 1024 chars → kind "max-length"', (type) => {
    const longDesc = 'x'.repeat(1025);
    const result = new SchemaValidator().validate({ ...validBase(type), description: longDesc });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const err = result.errors.find((e) => e.path === 'frontmatter.description');
    expect(err).toBeDefined();
    expect(err?.kind).toBe('max-length');
  });

  it.each(types)('%s: description "" → kind "min-length"', (type) => {
    const result = new SchemaValidator().validate({ ...validBase(type), description: '' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const err = result.errors.find((e) => e.path === 'frontmatter.description');
    expect(err).toBeDefined();
    expect(err?.kind).toBe('min-length');
  });
});
