import { describe, it, expect, vi } from 'vitest';
import { SearchService } from '../../../../../src/main/application/services/search-service.js';
import { InMemoryArtifactRepository } from '../../../../../src/main/infrastructure/artifact/in-memory-artifact-repository.js';

describe('SearchService — empty query (AC#3)', () => {
  it('query "" returns empty result without calling list', async () => {
    const artifactRepository = new InMemoryArtifactRepository();
    const listSpy = vi.spyOn(artifactRepository, 'list');
    const svc = new SearchService({ artifactRepository });

    const output = await svc.search('');

    expect(output).toEqual({ results: [], total: 0, truncated: false });
    expect(listSpy).not.toHaveBeenCalled();
  });

  it('query "   " (whitespace) returns empty result without calling list', async () => {
    const artifactRepository = new InMemoryArtifactRepository();
    const listSpy = vi.spyOn(artifactRepository, 'list');
    const svc = new SearchService({ artifactRepository });

    const output = await svc.search('   ');

    expect(output).toEqual({ results: [], total: 0, truncated: false });
    expect(listSpy).not.toHaveBeenCalled();
  });
});
