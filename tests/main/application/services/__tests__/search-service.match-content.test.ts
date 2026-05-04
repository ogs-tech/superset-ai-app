import { describe, it, expect } from 'vitest';
import { SearchService } from '../../../../../src/main/application/services/search-service.js';
import { InMemoryArtifactRepository } from '../../../../../src/main/infrastructure/artifact/in-memory-artifact-repository.js';
import type { Artifact } from '../../../../../src/shared/artifact.js';

const makeArtifact = (): Artifact => ({
  id: 'skill/other',
  frontmatter: {
    name: 'other',
    type: 'skill',
    description: 'A generic description',
    scopes: ['personal'],
    version: '1.0.0',
    createdAt: '',
    updatedAt: '',
  },
  body: 'This body contains the word review.',
});

describe('SearchService — match content (AC#5)', () => {
  it('artifact with body containing "review" (no name match) has matchedFields including "content"', async () => {
    const artifactRepository = new InMemoryArtifactRepository();
    await artifactRepository.save({ artifact: makeArtifact() });
    const svc = new SearchService({ artifactRepository });

    const output = await svc.search('review');

    expect(output.results.length).toBeGreaterThan(0);
    const result = output.results[0]!;
    expect(result.matchedFields).toContain('content');
    expect(result.matchedFields).not.toContain('name');
  });
});
