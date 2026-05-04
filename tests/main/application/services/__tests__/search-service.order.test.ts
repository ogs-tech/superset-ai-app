import { describe, it, expect } from 'vitest';
import { SearchService } from '../../../../../src/main/application/services/search-service.js';
import { InMemoryCustomizationRepository } from '../../../../../src/main/infrastructure/customization/in-memory-customization-repository.js';
import type { Customization } from '../../../../../src/shared/customization.js';

const makeCustomization = (name: string, body?: string): Customization => ({
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
    const repo = new InMemoryCustomizationRepository();
    await repo.save({ customization: makeCustomization('Banana') });
    await repo.save({ customization: makeCustomization('apple') });
    await repo.save({ customization: makeCustomization('Cherry', 'this body contains query') });
    await repo.save({ customization: makeCustomization('date', 'this body contains query') });
    const svc = new SearchService({ customizationRepository: repo });

    const out = await svc.search('query');

    const names = out.results.map((r) => r.customization.frontmatter.name);
    expect(names).toEqual(['Cherry', 'date']);
  });

  it('name-matches come before content-only matches', async () => {
    const repo = new InMemoryCustomizationRepository();
    await repo.save({ customization: makeCustomization('query-skill') });
    await repo.save({ customization: makeCustomization('other', 'has query in body') });
    const svc = new SearchService({ customizationRepository: repo });

    const out = await svc.search('query');

    const names = out.results.map((r) => r.customization.frontmatter.name);
    expect(names.indexOf('query-skill')).toBeLessThan(names.indexOf('other'));
  });
});
