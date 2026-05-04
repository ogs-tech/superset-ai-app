import { describe, it, expect } from 'vitest';
import { SearchService } from '../../../../../src/main/application/services/search-service.js';
import { InMemoryArtifactRepository } from '../../../../../src/main/infrastructure/artifact/in-memory-artifact-repository.js';
import type { Artifact } from '../../../../../src/shared/artifact.js';

const makeArtifact = (type: 'skill' | 'reference' | 'agent', name: string): Artifact => ({
  id: `${type}/${name}`,
  frontmatter: {
    name,
    type,
    description: 'x-target desc',
    scopes: ['personal'],
    version: '1.0.0',
    createdAt: '',
    updatedAt: '',
  },
  body: '# body',
});

describe('SearchService — filter types (AC#7)', () => {
  it('search with types:["skill"] returns only skills', async () => {
    const repo = new InMemoryArtifactRepository();
    await repo.save({ artifact: makeArtifact('skill', 'x-target') });
    await repo.save({ artifact: makeArtifact('reference', 'x-target') });
    await repo.save({ artifact: makeArtifact('agent', 'x-target') });
    const svc = new SearchService({ artifactRepository: repo });

    const out = await svc.search('x-target', { types: ['skill'] });

    expect(out.results).toHaveLength(1);
    expect(out.results[0]?.artifact.frontmatter.type).toBe('skill');
  });
});
