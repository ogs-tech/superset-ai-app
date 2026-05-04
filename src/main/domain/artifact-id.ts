import type { ArtifactType } from '../../shared/artifact.js';
import { DomainError } from './errors.js';
import { validateArtifactName } from './artifact-name.js';

const ARTIFACT_TYPES: readonly ArtifactType[] = [
  'skill',
  'reference',
  'agent',
  'global-instruction',
];

export interface ParsedArtifactId {
  type: ArtifactType;
  name: string;
}

export function parseArtifactId(id: string): ParsedArtifactId {
  const slashIndex = id.indexOf('/');
  if (slashIndex === -1) {
    throw new DomainError('validation', `Invalid artifact id: '${id}' (missing '/')`, {
      invalid: ['id'],
    });
  }
  const typeCandidate = id.slice(0, slashIndex);
  const name = id.slice(slashIndex + 1);
  if (!isArtifactType(typeCandidate)) {
    throw new DomainError(
      'validation',
      `Invalid artifact id: unknown type '${typeCandidate}'`,
      { invalid: ['id'] },
    );
  }
  if (name.length === 0) {
    throw new DomainError('validation', `Invalid artifact id: '${id}' (empty name)`, {
      invalid: ['id'],
    });
  }
  validateArtifactName(name);
  return { type: typeCandidate, name };
}

export function formatArtifactId(type: ArtifactType, name: string): string {
  return `${type}/${name}`;
}

function isArtifactType(value: string): value is ArtifactType {
  return (ARTIFACT_TYPES as readonly string[]).includes(value);
}
