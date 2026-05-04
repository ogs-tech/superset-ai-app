import { describe, it, expect } from 'vitest';
import { SearchService } from '../../../../../src/main/application/services/search-service.js';
import { InMemoryCustomizationRepository } from '../../../../../src/main/infrastructure/customization/in-memory-customization-repository.js';
import type { Customization } from '../../../../../src/shared/customization.js';

const makeCustomization = (i: number): Customization => ({
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
  it('10 matching customizations with limit 5 → { results[5], total:10, truncated:true }', async () => {
    const repo = new InMemoryCustomizationRepository();
    for (let i = 0; i < 10; i++) await repo.save({ customization: makeCustomization(i) });
    const svc = new SearchService({ customizationRepository: repo });

    const out = await svc.search('x-limit', { limit: 5 });

    expect(out.results).toHaveLength(5);
    expect(out.total).toBe(10);
    expect(out.truncated).toBe(true);
  });

  it('search without limit uses default 50', async () => {
    const repo = new InMemoryCustomizationRepository();
    for (let i = 0; i < 10; i++) await repo.save({ customization: makeCustomization(i) });
    const svc = new SearchService({ customizationRepository: repo });

    const out = await svc.search('x-limit');

    expect(out.results).toHaveLength(10);
    expect(out.truncated).toBe(false);
  });
});
