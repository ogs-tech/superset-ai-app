import { describe, expect, it } from 'vitest';
import { validateArtifactName } from '../../../src/main/domain/artifact-name.js';
import { DomainError } from '../../../src/main/domain/errors.js';

describe('validateArtifactName', () => {
  it('accepts lowercase letters only', () => {
    expect(() => validateArtifactName('skill')).not.toThrow();
  });

  it('accepts lowercase + digits + hyphens', () => {
    expect(() => validateArtifactName('my-skill-123')).not.toThrow();
  });

  it('accepts a single character', () => {
    expect(() => validateArtifactName('a')).not.toThrow();
  });

  it('accepts up to 64 characters', () => {
    expect(() => validateArtifactName('a'.repeat(64))).not.toThrow();
  });

  it('rejects uppercase letters with kind=validation', () => {
    expect(() => validateArtifactName('My-Skill')).toThrow(DomainError);
    try {
      validateArtifactName('My-Skill');
    } catch (err) {
      expect((err as DomainError).kind).toBe('validation');
    }
  });

  it('rejects spaces', () => {
    expect(() => validateArtifactName('my skill')).toThrow(DomainError);
  });

  it('rejects underscores', () => {
    expect(() => validateArtifactName('my_skill')).toThrow(DomainError);
  });

  it('rejects accents', () => {
    expect(() => validateArtifactName('café')).toThrow(DomainError);
  });

  it('rejects empty string', () => {
    expect(() => validateArtifactName('')).toThrow(DomainError);
  });

  it('rejects strings longer than 64 characters', () => {
    expect(() => validateArtifactName('a'.repeat(65))).toThrow(DomainError);
  });

  it('rejects leading hyphen', () => {
    expect(() => validateArtifactName('-skill')).toThrow(DomainError);
  });

  it('rejects trailing hyphen', () => {
    expect(() => validateArtifactName('skill-')).toThrow(DomainError);
  });

  it('includes invalid: ["name"] in DomainError details', () => {
    try {
      validateArtifactName('Bad Name');
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).details).toEqual({ invalid: ['name'] });
    }
  });
});
