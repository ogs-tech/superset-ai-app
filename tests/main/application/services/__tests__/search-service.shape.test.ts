import { describe, it, expect } from 'vitest';
import { SearchService } from '../../../../../src/main/application/services/search-service.js';
import { InMemoryArtifactRepository } from '../../../../../src/main/infrastructure/artifact/in-memory-artifact-repository.js';
import type { Artifact } from '../../../../../src/shared/artifact.js';

const makeArtifact = (name: string): Artifact => ({
  id: `skill/${name}`,
  frontmatter: {
    name,
    type: 'skill',
    description: `review ${name}`,
    scopes: ['personal'],
    version: '1.0.0',
    createdAt: '',
    updatedAt: '',
  },
  body: `# ${name}`,
});

describe('SearchService — shape (AC#2)', () => {
  it('each SearchResult has { artifact, matchedFields } where matchedFields is subset of ["name","description","content"]', async () => {
    const artifactRepository = new InMemoryArtifactRepository();
    await artifactRepository.save({ artifact: makeArtifact('review') });
    const svc = new SearchService({ artifactRepository });

    const output = await svc.search('review');

    expect(output.results.length).toBeGreaterThan(0);
    for (const result of output.results) {
      expect(result.artifact).toBeDefined();
      expect(Array.isArray(result.matchedFields)).toBe(true);
      for (const field of result.matchedFields) {
        expect(['name', 'description', 'content']).toContain(field);
      }
    }
  });
});
