import { describe, it, expect } from 'vitest';
import { SearchService } from '../../../../../src/main/application/services/search-service.js';
import { InMemoryCustomizationRepository } from '../../../../../src/main/infrastructure/customization/in-memory-customization-repository.js';
import type { Customization } from '../../../../../src/shared/customization.js';

const BODY_SIZE = 350;
const ARTIFACT_COUNT = 100;

const makeCustomization = (i: number): Customization => ({
  id: `skill/art-${i}`,
  frontmatter: {
    name: `art-${i}`,
    type: 'skill',
    description: `Description for customization ${i}`,
    scopes: ['personal'],
    version: '1.0.0',
    createdAt: '',
    updatedAt: '',
  },
  body: `# Art ${i}\n` + Array.from({ length: BODY_SIZE }, (_, j) => `line ${i}-${j} content review search`).join('\n'),
});

describe('SearchService — perf benchmark (AC#17)', () => {
  it('search over 100 customizations with 300+ LOC bodies completes in < 100ms', async () => {
    const repo = new InMemoryCustomizationRepository();
    for (let i = 0; i < ARTIFACT_COUNT; i++) {
      await repo.save({ customization: makeCustomization(i) });
    }
    const svc = new SearchService({ customizationRepository: repo });

    const start = performance.now();
    await svc.search('review');
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(100);
  });
});
