import { describe, it, expect, vi } from 'vitest';
import { SearchService } from '../../../../../src/main/application/services/search-service.js';
import { InMemoryArtifactRepository } from '../../../../../src/main/infrastructure/artifact/in-memory-artifact-repository.js';

describe('SearchService — no cache (AC#16)', () => {
  it('3 consecutive search calls invoke ArtifactRepository.list 3 times', async () => {
    const repo = new InMemoryArtifactRepository();
    const listSpy = vi.spyOn(repo, 'list');
    const svc = new SearchService({ artifactRepository: repo });

    await svc.search('x');
    await svc.search('x');
    await svc.search('x');

    expect(listSpy).toHaveBeenCalledTimes(3);
  });
});
