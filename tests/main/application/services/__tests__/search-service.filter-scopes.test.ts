import { describe, it, expect } from 'vitest';
import { SearchService } from '../../../../../src/main/application/services/search-service.js';
import { InMemoryArtifactRepository } from '../../../../../src/main/infrastructure/artifact/in-memory-artifact-repository.js';
import type { Artifact, ArtifactScope } from '../../../../../src/shared/artifact.js';

const makeArtifact = (scopes: ArtifactScope[]): Artifact => ({
  id: `skill/x-scope-${scopes.join('-')}`,
  frontmatter: {
    name: `x-scope-${scopes.join('-')}`,
    type: 'skill',
    description: 'desc',
    scopes,
    version: '1.0.0',
    createdAt: '',
    updatedAt: '',
  },
  body: '# body',
});

describe('SearchService — filter scopes (AC#8)', () => {
  it('search with scopes:["personal"] excludes project-only artifacts', async () => {
    const repo = new InMemoryArtifactRepository();
    await repo.save({ artifact: makeArtifact(['personal']) });
    await repo.save({ artifact: makeArtifact(['project']) });
    await repo.save({ artifact: makeArtifact(['personal', 'project']) });
    const svc = new SearchService({ artifactRepository: repo });

    const out = await svc.search('x-scope', { scopes: ['personal'] });

    expect(out.results).toHaveLength(2);
    for (const r of out.results) {
      expect(r.artifact.frontmatter.scopes).toContain('personal');
    }
  });
});
