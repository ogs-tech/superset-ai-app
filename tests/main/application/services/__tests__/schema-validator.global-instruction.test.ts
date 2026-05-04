import { describe, it, expect } from 'vitest';
import { SchemaValidator } from '../../../../../src/main/application/services/schema-validator.js';
import type { ArtifactFrontmatter } from '../../../../../src/shared/artifact.js';

const validGlobalInstruction: ArtifactFrontmatter = {
  name: 'claude',
  type: 'global-instruction',
  description: 'A valid global instruction',
  scopes: ['personal'],
  version: '1.0.0',
  createdAt: '2026-05-03T00:00:00.000Z',
  updatedAt: '2026-05-03T00:00:00.000Z',
};

describe('SchemaValidator — global-instruction (AC#3, AC#4)', () => {
  it('valid global-instruction with slug "claude" → ok: true', () => {
    const result = new SchemaValidator().validate(validGlobalInstruction);
    expect(result.ok).toBe(true);
  });

  it('valid global-instruction with slug "copilot" → ok: true', () => {
    const result = new SchemaValidator().validate({ ...validGlobalInstruction, name: 'copilot' } as ArtifactFrontmatter);
    expect(result.ok).toBe(true);
  });
});
