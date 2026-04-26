import type { ArtifactType } from '../../shared/artifact.js';
import { DomainError } from './errors.js';

const ARTIFACT_TYPES: readonly ArtifactType[] = ['skill', 'reference', 'agent'];

export interface ParsedArtifactId {
  type: ArtifactType;
  slug: string;
}

export function parseArtifactId(id: string): ParsedArtifactId {
  const slashIndex = id.indexOf('/');
  if (slashIndex === -1) {
    throw new DomainError('validation', `Invalid artifact id: '${id}' (missing '/')`, {
      invalid: ['id'],
    });
  }
  const typeCandidate = id.slice(0, slashIndex);
  const slug = id.slice(slashIndex + 1);
  if (!isArtifactType(typeCandidate)) {
    throw new DomainError(
      'validation',
      `Invalid artifact id: unknown type '${typeCandidate}'`,
      { invalid: ['id'] },
    );
  }
  if (slug.length === 0) {
    throw new DomainError('validation', `Invalid artifact id: '${id}' (empty slug)`, {
      invalid: ['id'],
    });
  }
  return { type: typeCandidate, slug };
}

export function formatArtifactId(type: ArtifactType, slug: string): string {
  return `${type}/${slug}`;
}

function isArtifactType(value: string): value is ArtifactType {
  return (ARTIFACT_TYPES as readonly string[]).includes(value);
}
