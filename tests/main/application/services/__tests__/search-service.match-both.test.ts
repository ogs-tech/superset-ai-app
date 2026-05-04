import { describe, it, expect } from 'vitest';
import { SearchService } from '../../../../../src/main/application/services/search-service.js';
import { InMemoryCustomizationRepository } from '../../../../../src/main/infrastructure/customization/in-memory-customization-repository.js';
import type { Customization } from '../../../../../src/shared/customization.js';

const makeCustomization = (): Customization => ({
  id: 'skill/review',
  frontmatter: {
    name: 'review',
    type: 'skill',
    description: 'A generic description',
    scopes: ['personal'],
    version: '1.0.0',
    createdAt: '',
    updatedAt: '',
  },
  body: 'This body contains the word review.',
});

describe('SearchService — match both (AC#6)', () => {
  it('customization where query matches both name and content has matchedFields === ["name","content"] (fixed order)', async () => {
    const customizationRepository = new InMemoryCustomizationRepository();
    await customizationRepository.save({ customization: makeCustomization() });
    const svc = new SearchService({ customizationRepository });

    const output = await svc.search('review');

    expect(output.results.length).toBeGreaterThan(0);
    const result = output.results[0]!;
    expect(result.matchedFields).toContain('name');
    expect(result.matchedFields).toContain('content');
    const nameIdx = result.matchedFields.indexOf('name');
    const contentIdx = result.matchedFields.indexOf('content');
    expect(nameIdx).toBeLessThan(contentIdx);
  });
});
