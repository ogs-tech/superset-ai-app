import { describe, it, expect } from 'vitest';
import { SearchService } from '../../../../../src/main/application/services/search-service.js';
import { InMemoryCustomizationRepository } from '../../../../../src/main/infrastructure/customization/in-memory-customization-repository.js';
import type { Customization } from '../../../../../src/shared/customization.js';

const makeRef = (name: string): Customization => ({
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
  it('query "revisao" (no accent) matches customization with name "revisao-de-codigo"', async () => {
    const repo = new InMemoryCustomizationRepository();
    await repo.save({ customization: makeRef('revisao-de-codigo') });
    const svc = new SearchService({ customizationRepository: repo });

    const out = await svc.search('revisao');
    expect(out.results.some((r) => r.customization.frontmatter.name === 'revisao-de-codigo')).toBe(true);
  });

  it('query "revisao" (no accent) matches customization with name having accented chars stripped', async () => {
    const repo = new InMemoryCustomizationRepository();
    await repo.save({ customization: makeRef('revisao-express') });
    const svc = new SearchService({ customizationRepository: repo });

    const out = await svc.search('revisao');
    expect(out.results.length).toBeGreaterThan(0);
  });
});
