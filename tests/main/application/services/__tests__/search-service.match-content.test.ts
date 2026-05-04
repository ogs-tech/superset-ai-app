import { describe, it, expect } from 'vitest';
import { SearchService } from '../../../../../src/main/application/services/search-service.js';
import { InMemoryCustomizationRepository } from '../../../../../src/main/infrastructure/customization/in-memory-customization-repository.js';
import type { Customization } from '../../../../../src/shared/customization.js';

const makeCustomization = (): Customization => ({
  id: 'skill/other',
  frontmatter: {
    name: 'other',
    type: 'skill',
    description: 'A generic description',
    scopes: ['personal'],
    version: '1.0.0',
    createdAt: '',
    updatedAt: '',
  },
  body: 'This body contains the word review.',
});

describe('SearchService — match content (AC#5)', () => {
  it('customization with body containing "review" (no name match) has matchedFields including "content"', async () => {
    const customizationRepository = new InMemoryCustomizationRepository();
    await customizationRepository.save({ customization: makeCustomization() });
    const svc = new SearchService({ customizationRepository });

    const output = await svc.search('review');

    expect(output.results.length).toBeGreaterThan(0);
    const result = output.results[0]!;
    expect(result.matchedFields).toContain('content');
    expect(result.matchedFields).not.toContain('name');
  });
});
