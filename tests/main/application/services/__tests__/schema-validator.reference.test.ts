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

describe('SchemaValidator — reference (AC#3, AC#4)', () => {
  it('valid reference without includeInCopilotInstructions → ok: true', () => {
    const result = new SchemaValidator().validate(validRef);
    expect(result.ok).toBe(true);
  });

  it('valid reference with includeInCopilotInstructions: true → ok: true', () => {
    const result = new SchemaValidator().validate({ ...validRef, includeInCopilotInstructions: true } as ArtifactFrontmatter);
    expect(result.ok).toBe(true);
  });

  it('valid reference with includeInCopilotInstructions: false → ok: true', () => {
    const result = new SchemaValidator().validate({ ...validRef, includeInCopilotInstructions: false } as ArtifactFrontmatter);
    expect(result.ok).toBe(true);
  });
});
