import { describe, it, expect } from 'vitest';
import { SearchService } from '../../../../../src/main/application/services/search-service.js';
import { InMemoryArtifactRepository } from '../../../../../src/main/infrastructure/artifact/in-memory-artifact-repository.js';
import type { Artifact } from '../../../../../src/shared/artifact.js';

const makeArtifact = (i: number): Artifact => ({
  id: `skill/art-${i}`,
  frontmatter: {
    name: `art-${i}`,
    type: 'skill',
    description: 'x-limit',
    scopes: ['personal'],
    version: '1.0.0',
    createdAt: '',
    updatedAt: '',
  },
  body: '# body',
});

describe('SearchService — limit (AC#9)', () => {
  it('10 matching artifacts with limit 5 → { results[5], total:10, truncated:true }', async () => {
    const repo = new InMemoryArtifactRepository();
    for (let i = 0; i < 10; i++) await repo.save({ artifact: makeArtifact(i) });
    const svc = new SearchService({ artifactRepository: repo });

    const out = await svc.search('x-limit', { limit: 5 });

    expect(out.results).toHaveLength(5);
    expect(out.total).toBe(10);
    expect(out.truncated).toBe(true);
  });

  it('search without limit uses default 50', async () => {
    const repo = new InMemoryArtifactRepository();
    for (let i = 0; i < 10; i++) await repo.save({ artifact: makeArtifact(i) });
    const svc = new SearchService({ artifactRepository: repo });

    const out = await svc.search('x-limit');

    expect(out.results).toHaveLength(10);
    expect(out.truncated).toBe(false);
  });
});
