import { DomainError } from './errors.js';

const ARTIFACT_NAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

export function validateArtifactName(name: string): void {
  if (typeof name !== 'string' || !ARTIFACT_NAME_PATTERN.test(name)) {
    throw new DomainError(
      'validation',
      `Invalid artifact name: '${name}' (must be 1-64 chars, lowercase letters, digits, hyphens; no leading or trailing hyphen)`,
      { invalid: ['name'] },
    );
  }
}

export function isValidArtifactName(name: string): boolean {
  return typeof name === 'string' && ARTIFACT_NAME_PATTERN.test(name);
}
