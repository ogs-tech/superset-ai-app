import { describe, it, expect } from 'vitest';
import { SearchService } from '../../../../../src/main/application/services/search-service.js';
import { InMemoryArtifactRepository } from '../../../../../src/main/infrastructure/artifact/in-memory-artifact-repository.js';
import type { Artifact } from '../../../../../src/shared/artifact.js';

const makeArtifact = (): Artifact => ({
  id: 'skill/review',
  frontmatter: {
    name: 'review',
    type: 'skill',
    description: 'A generic description',
    scopes: ['personal'],
    version: '1.0.0',
    createdAt: '',
    updatedAt: '',
  },
  body: 'This body contains the word review.',
});

describe('SearchService — match both (AC#6)', () => {
  it('artifact where query matches both name and content has matchedFields === ["name","content"] (fixed order)', async () => {
    const artifactRepository = new InMemoryArtifactRepository();
    await artifactRepository.save({ artifact: makeArtifact() });
    const svc = new SearchService({ artifactRepository });

    const output = await svc.search('review');

    expect(output.results.length).toBeGreaterThan(0);
    const result = output.results[0]!;
    expect(result.matchedFields).toContain('name');
    expect(result.matchedFields).toContain('content');
    const nameIdx = result.matchedFields.indexOf('name');
    const contentIdx = result.matchedFields.indexOf('content');
    expect(nameIdx).toBeLessThan(contentIdx);
  });
});
