import type { Artifact, ArtifactType, ArtifactScope } from './artifact.js';

export interface SearchOptions {
  types?: ArtifactType[];
  scopes?: ArtifactScope[];
  limit?: number;
}

export interface SearchResult {
  artifact: Artifact;
  matchedFields: Array<'name' | 'description' | 'content'>;
}

export interface SearchOutput {
  results: SearchResult[];
  total: number;
  truncated: boolean;
}
