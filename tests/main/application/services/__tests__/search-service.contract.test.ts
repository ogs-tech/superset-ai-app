import { describe, it, expect } from 'vitest';
import { SearchService } from '../../../../../src/main/application/services/search-service.js';
import { InMemoryArtifactRepository } from '../../../../../src/main/infrastructure/artifact/in-memory-artifact-repository.js';

describe('SearchService — contract (AC#1)', () => {
  it('search(query) resolves with { results: SearchResult[], total: number, truncated: boolean }', async () => {
    const artifactRepository = new InMemoryArtifactRepository();
    const svc = new SearchService({ artifactRepository });

    const output = await svc.search('x');

    expect(Array.isArray(output.results)).toBe(true);
    expect(typeof output.total).toBe('number');
    expect(typeof output.truncated).toBe('boolean');
  });
});
