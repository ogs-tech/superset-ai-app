import { describe, it, expect } from 'vitest';
import { SearchService } from '../../../../../src/main/application/services/search-service.js';
import { InMemoryCustomizationRepository } from '../../../../../src/main/infrastructure/customization/in-memory-customization-repository.js';
import type { Customization } from '../../../../../src/shared/customization.js';

const makeCustomization = (): Customization => ({
  id: 'skill/code-review',
  frontmatter: {
    name: 'code-review',
    type: 'skill',
    description: 'A generic description',
    scopes: ['personal'],
    version: '1.0.0',
    createdAt: '',
    updatedAt: '',
  },
  body: '# Code Review skill',
});

describe('SearchService — match name (AC#4)', () => {
  it('customization with name "code-review" matches query "REVIEW" (case-insensitive)', async () => {
    const customizationRepository = new InMemoryCustomizationRepository();
    await customizationRepository.save({ customization: makeCustomization() });
    const svc = new SearchService({ customizationRepository });

    const output = await svc.search('REVIEW');

    expect(output.results.length).toBeGreaterThan(0);
    const result = output.results[0]!;
    expect(result.matchedFields).toContain('name');
  });
});
