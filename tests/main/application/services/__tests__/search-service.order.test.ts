import { describe, it, expect } from 'vitest';
import { SearchService } from '../../../../../src/main/application/services/search-service.js';
import { InMemoryArtifactRepository } from '../../../../../src/main/infrastructure/artifact/in-memory-artifact-repository.js';
import type { Artifact } from '../../../../../src/shared/artifact.js';

const makeArtifact = (name: string, body?: string): Artifact => ({
  id: `skill/${name}`,
  frontmatter: {
    name,
    type: 'skill',
    description: 'desc',
    scopes: ['personal'],
    version: '1.0.0',
    createdAt: '',
    updatedAt: '',
  },
  body: body ?? '# no match',
});

describe('SearchService — order (AC#10)', () => {
  it('name-matches first, then content-only; alphabetical within each bucket', async () => {
    const repo = new InMemoryArtifactRepository();
    await repo.save({ artifact: makeArtifact('Banana') });
    await repo.save({ artifact: makeArtifact('apple') });
    await repo.save({ artifact: makeArtifact('Cherry', 'this body contains query') });
    await repo.save({ artifact: makeArtifact('date', 'this body contains query') });
    const svc = new SearchService({ artifactRepository: repo });

    const out = await svc.search('query');

    const names = out.results.map((r) => r.artifact.frontmatter.name);
    expect(names).toEqual(['Cherry', 'date']);
  });

  it('name-matches come before content-only matches', async () => {
    const repo = new InMemoryArtifactRepository();
    await repo.save({ artifact: makeArtifact('query-skill') });
    await repo.save({ artifact: makeArtifact('other', 'has query in body') });
    const svc = new SearchService({ artifactRepository: repo });

    const out = await svc.search('query');

    const names = out.results.map((r) => r.artifact.frontmatter.name);
    expect(names.indexOf('query-skill')).toBeLessThan(names.indexOf('other'));
  });
});
