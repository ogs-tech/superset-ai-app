import type { Customization, CustomizationType, CustomizationScope } from './customization.js';

export interface SearchOptions {
  types?: CustomizationType[];
  scopes?: CustomizationScope[];
  limit?: number;
}

export interface SearchResult {
  customization: Customization;
  matchedFields: Array<'name' | 'description' | 'content'>;
}

export interface SearchOutput {
  results: SearchResult[];
  total: number;
  truncated: boolean;
}
