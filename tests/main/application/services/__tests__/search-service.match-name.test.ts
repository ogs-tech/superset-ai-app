import { describe, it, expect } from 'vitest';
import { SearchService } from '../../../../../src/main/application/services/search-service.js';
import { InMemoryArtifactRepository } from '../../../../../src/main/infrastructure/artifact/in-memory-artifact-repository.js';
import type { Artifact } from '../../../../../src/shared/artifact.js';

const makeArtifact = (): Artifact => ({
  id: 'skill/code-review',
  frontmatter: {
    name: 'code-review',
    type: 'skill',
    description: 'A generic description',
    scopes: ['personal'],
    version: '1.0.0',
    createdAt: '',
    updatedAt: '',
  },
  body: '# Code Review skill',
});

describe('SearchService — match name (AC#4)', () => {
  it('artifact with name "code-review" matches query "REVIEW" (case-insensitive)', async () => {
    const artifactRepository = new InMemoryArtifactRepository();
    await artifactRepository.save({ artifact: makeArtifact() });
    const svc = new SearchService({ artifactRepository });

    const output = await svc.search('REVIEW');

    expect(output.results.length).toBeGreaterThan(0);
    const result = output.results[0]!;
    expect(result.matchedFields).toContain('name');
  });
});
