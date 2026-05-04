import { describe, it, expect } from 'vitest';
import { SearchService } from '../../../../../src/main/application/services/search-service.js';
import { InMemoryCustomizationRepository } from '../../../../../src/main/infrastructure/customization/in-memory-customization-repository.js';
import type { Customization } from '../../../../../src/shared/customization.js';

const makeCustomization = (type: 'skill' | 'reference' | 'agent', name: string): Customization => ({
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
    const repo = new InMemoryCustomizationRepository();
    await repo.save({ customization: makeCustomization('skill', 'x-target') });
    await repo.save({ customization: makeCustomization('reference', 'x-target') });
    await repo.save({ customization: makeCustomization('agent', 'x-target') });
    const svc = new SearchService({ customizationRepository: repo });

    const out = await svc.search('x-target', { types: ['skill'] });

    expect(out.results).toHaveLength(1);
    expect(out.results[0]?.customization.frontmatter.type).toBe('skill');
  });
});
