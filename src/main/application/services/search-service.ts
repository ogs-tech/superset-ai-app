import type { CustomizationRepository } from '../ports/customization-repository.js';
import type { SearchOptions, SearchOutput, SearchResult } from '../../../shared/search.js';

export type { SearchOptions, SearchOutput, SearchResult };

export interface SearchServiceDeps {
  customizationRepository: CustomizationRepository;
}

const DEFAULT_LIMIT = 50;

const normalize = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export class SearchService {
  private readonly customizationRepository: CustomizationRepository;

  constructor(deps: SearchServiceDeps) {
    this.customizationRepository = deps.customizationRepository;
  }

  async search(query: string, options?: SearchOptions): Promise<SearchOutput> {
    const trimmed = query.trim();
    if (!trimmed) {
      return { results: [], total: 0, truncated: false };
    }

    const normalizedQuery = normalize(trimmed);
    const limit = options?.limit ?? DEFAULT_LIMIT;

    const all = await this.customizationRepository.list();
    const matched: SearchResult[] = [];

    for (const customization of all) {
      if (options?.types && !options.types.includes(customization.frontmatter.type)) continue;
      if (options?.scopes) {
        const hasScope = options.scopes.some((s) => customization.frontmatter.scopes.includes(s));
        if (!hasScope) continue;
      }

      const matchedFields: Array<'name' | 'description' | 'content'> = [];
      if (normalize(customization.frontmatter.name).includes(normalizedQuery)) {
        matchedFields.push('name');
      }
      if (normalize(customization.frontmatter.description).includes(normalizedQuery)) {
        matchedFields.push('description');
      }
      if (normalize(customization.body).includes(normalizedQuery)) {
        matchedFields.push('content');
      }

      if (matchedFields.length > 0) {
        matched.push({ customization, matchedFields });
      }
    }

    const collator = new Intl.Collator('en');
    matched.sort((a, b) => {
      const aNameMatch = a.matchedFields.includes('name');
      const bNameMatch = b.matchedFields.includes('name');
      if (aNameMatch !== bNameMatch) return aNameMatch ? -1 : 1;
      return collator.compare(a.customization.frontmatter.name, b.customization.frontmatter.name);
    });

    const total = matched.length;
    const truncated = total > limit;
    const results = matched.slice(0, limit);

    return { results, total, truncated };
  }
}
