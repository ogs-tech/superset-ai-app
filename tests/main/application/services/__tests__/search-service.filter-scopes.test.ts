import { describe, it, expect } from 'vitest';
import { SearchService } from '../../../../../src/main/application/services/search-service.js';
import { InMemoryCustomizationRepository } from '../../../../../src/main/infrastructure/customization/in-memory-customization-repository.js';
import type { Customization, CustomizationScope } from '../../../../../src/shared/customization.js';

const makeCustomization = (scopes: CustomizationScope[]): Customization => ({
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
  it('search with scopes:["personal"] excludes project-only customizations', async () => {
    const repo = new InMemoryCustomizationRepository();
    await repo.save({ customization: makeCustomization(['personal']) });
    await repo.save({ customization: makeCustomization(['project']) });
    await repo.save({ customization: makeCustomization(['personal', 'project']) });
    const svc = new SearchService({ customizationRepository: repo });

    const out = await svc.search('x-scope', { scopes: ['personal'] });

    expect(out.results).toHaveLength(2);
    for (const r of out.results) {
      expect(r.customization.frontmatter.scopes).toContain('personal');
    }
  });
});
