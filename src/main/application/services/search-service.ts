import type { ArtifactRepository } from '../ports/artifact-repository.js';
import type { SearchOptions, SearchOutput, SearchResult } from '../../../shared/search.js';

export type { SearchOptions, SearchOutput, SearchResult };

export interface SearchServiceDeps {
  artifactRepository: ArtifactRepository;
}

const DEFAULT_LIMIT = 50;

const normalize = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export class SearchService {
  private readonly artifactRepository: ArtifactRepository;

  constructor(deps: SearchServiceDeps) {
    this.artifactRepository = deps.artifactRepository;
  }

  async search(query: string, options?: SearchOptions): Promise<SearchOutput> {
    const trimmed = query.trim();
    if (!trimmed) {
      return { results: [], total: 0, truncated: false };
    }

    const normalizedQuery = normalize(trimmed);
    const limit = options?.limit ?? DEFAULT_LIMIT;

    const all = await this.artifactRepository.list();
    const matched: SearchResult[] = [];

    for (const artifact of all) {
      if (options?.types && !options.types.includes(artifact.frontmatter.type)) continue;
      if (options?.scopes) {
        const hasScope = options.scopes.some((s) => artifact.frontmatter.scopes.includes(s));
        if (!hasScope) continue;
      }

      const matchedFields: Array<'name' | 'description' | 'content'> = [];
      if (normalize(artifact.frontmatter.name).includes(normalizedQuery)) {
        matchedFields.push('name');
      }
      if (normalize(artifact.frontmatter.description).includes(normalizedQuery)) {
        matchedFields.push('description');
      }
      if (normalize(artifact.body).includes(normalizedQuery)) {
        matchedFields.push('content');
      }

      if (matchedFields.length > 0) {
        matched.push({ artifact, matchedFields });
      }
    }

    const collator = new Intl.Collator('en');
    matched.sort((a, b) => {
      const aNameMatch = a.matchedFields.includes('name');
      const bNameMatch = b.matchedFields.includes('name');
      if (aNameMatch !== bNameMatch) return aNameMatch ? -1 : 1;
      return collator.compare(a.artifact.frontmatter.name, b.artifact.frontmatter.name);
    });

    const total = matched.length;
    const truncated = total > limit;
    const results = matched.slice(0, limit);

    return { results, total, truncated };
  }
}
