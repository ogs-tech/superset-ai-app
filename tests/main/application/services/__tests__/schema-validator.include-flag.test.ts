import { describe, it, expect } from 'vitest';
import { SchemaValidator } from '../../../../../src/main/application/services/schema-validator.js';
import type { ArtifactFrontmatter, ArtifactType } from '../../../../../src/shared/artifact.js';

const makeArtifact = (type: ArtifactType): ArtifactFrontmatter => ({
  name: type === 'global-instruction' ? 'claude' : 'my-artifact',
  type,
  description: 'A valid description',
  scopes: ['personal'],
  version: '1.0.0',
  createdAt: '2026-05-03T00:00:00.000Z',
  updatedAt: '2026-05-03T00:00:00.000Z',
  includeInCopilotInstructions: false,
});

const nonRefTypes: ArtifactType[] = ['skill', 'agent', 'global-instruction'];

describe('SchemaValidator — includeInCopilotInstructions not-allowed (AC#12)', () => {
  it.each(nonRefTypes)('%s with includeInCopilotInstructions: false → kind "not-allowed"', (type) => {
    const result = new SchemaValidator().validate(makeArtifact(type));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const err = result.errors.find((e) => e.path === 'frontmatter.includeInCopilotInstructions');
    expect(err).toBeDefined();
    expect(err?.kind).toBe('not-allowed');
  });
});
