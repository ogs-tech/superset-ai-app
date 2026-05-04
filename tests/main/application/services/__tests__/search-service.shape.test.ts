import { describe, it, expect } from 'vitest';
import { SearchService } from '../../../../../src/main/application/services/search-service.js';
import { InMemoryCustomizationRepository } from '../../../../../src/main/infrastructure/customization/in-memory-customization-repository.js';
import type { Customization } from '../../../../../src/shared/customization.js';

const makeCustomization = (name: string): Customization => ({
  id: `skill/${name}`,
  frontmatter: {
    name,
    type: 'skill',
    description: `review ${name}`,
    scopes: ['personal'],
    version: '1.0.0',
    createdAt: '',
    updatedAt: '',
  },
  body: `# ${name}`,
});

describe('SearchService — shape (AC#2)', () => {
  it('each SearchResult has { customization, matchedFields } where matchedFields is subset of ["name","description","content"]', async () => {
    const customizationRepository = new InMemoryCustomizationRepository();
    await customizationRepository.save({ customization: makeCustomization('review') });
    const svc = new SearchService({ customizationRepository });

    const output = await svc.search('review');

    expect(output.results.length).toBeGreaterThan(0);
    for (const result of output.results) {
      expect(result.customization).toBeDefined();
      expect(Array.isArray(result.matchedFields)).toBe(true);
      for (const field of result.matchedFields) {
        expect(['name', 'description', 'content']).toContain(field);
      }
    }
  });
});
