import { describe, it, expect } from 'vitest';
import { SearchService } from '../../../../../src/main/application/services/search-service.js';
import { InMemoryArtifactRepository } from '../../../../../src/main/infrastructure/artifact/in-memory-artifact-repository.js';
import type { Artifact } from '../../../../../src/shared/artifact.js';

const BODY_SIZE = 350;
const ARTIFACT_COUNT = 100;

const makeArtifact = (i: number): Artifact => ({
  id: `skill/art-${i}`,
  frontmatter: {
    name: `art-${i}`,
    type: 'skill',
    description: `Description for artifact ${i}`,
    scopes: ['personal'],
    version: '1.0.0',
    createdAt: '',
    updatedAt: '',
  },
  body: `# Art ${i}\n` + Array.from({ length: BODY_SIZE }, (_, j) => `line ${i}-${j} content review search`).join('\n'),
});

describe('SearchService — perf benchmark (AC#17)', () => {
  it('search over 100 artifacts with 300+ LOC bodies completes in < 100ms', async () => {
    const repo = new InMemoryArtifactRepository();
    for (let i = 0; i < ARTIFACT_COUNT; i++) {
      await repo.save({ artifact: makeArtifact(i) });
    }
    const svc = new SearchService({ artifactRepository: repo });

    const start = performance.now();
    await svc.search('review');
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(100);
  });
});
