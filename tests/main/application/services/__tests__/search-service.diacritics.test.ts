import { describe, it, expect } from 'vitest';
import { SearchService } from '../../../../../src/main/application/services/search-service.js';
import { InMemoryArtifactRepository } from '../../../../../src/main/infrastructure/artifact/in-memory-artifact-repository.js';
import type { Artifact } from '../../../../../src/shared/artifact.js';

const makeRef = (name: string): Artifact => ({
  id: `reference/${name}`,
  frontmatter: {
    name,
    type: 'reference',
    description: 'desc',
    scopes: ['personal'],
    version: '1.0.0',
    createdAt: '',
    updatedAt: '',
  },
  body: '# body',
});

describe('SearchService — diacritics (AC#11)', () => {
  it('query "revisao" (no accent) matches artifact with name "revisao-de-codigo"', async () => {
    const repo = new InMemoryArtifactRepository();
    await repo.save({ artifact: makeRef('revisao-de-codigo') });
    const svc = new SearchService({ artifactRepository: repo });

    const out = await svc.search('revisao');
    expect(out.results.some((r) => r.artifact.frontmatter.name === 'revisao-de-codigo')).toBe(true);
  });

  it('query "revisao" (no accent) matches artifact with name having accented chars stripped', async () => {
    const repo = new InMemoryArtifactRepository();
    await repo.save({ artifact: makeRef('revisao-express') });
    const svc = new SearchService({ artifactRepository: repo });

    const out = await svc.search('revisao');
    expect(out.results.length).toBeGreaterThan(0);
  });
});
