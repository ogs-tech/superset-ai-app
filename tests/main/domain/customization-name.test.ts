import { describe, expect, it } from 'vitest';
import { validateCustomizationName } from '../../../src/main/domain/customization-name.js';
import { DomainError } from '../../../src/main/domain/errors.js';

describe('validateCustomizationName', () => {
  it('accepts lowercase letters only', () => {
    expect(() => validateCustomizationName('skill')).not.toThrow();
  });

  it('accepts lowercase + digits + hyphens', () => {
    expect(() => validateCustomizationName('my-skill-123')).not.toThrow();
  });

  it('accepts a single character', () => {
    expect(() => validateCustomizationName('a')).not.toThrow();
  });

  it('accepts up to 64 characters', () => {
    expect(() => validateCustomizationName('a'.repeat(64))).not.toThrow();
  });

  it('rejects uppercase letters with kind=validation', () => {
    expect(() => validateCustomizationName('My-Skill')).toThrow(DomainError);
    try {
      validateCustomizationName('My-Skill');
    } catch (err) {
      expect((err as DomainError).kind).toBe('validation');
    }
  });

  it('rejects spaces', () => {
    expect(() => validateCustomizationName('my skill')).toThrow(DomainError);
  });

  it('rejects underscores', () => {
    expect(() => validateCustomizationName('my_skill')).toThrow(DomainError);
  });

  it('rejects accents', () => {
    expect(() => validateCustomizationName('café')).toThrow(DomainError);
  });

  it('rejects empty string', () => {
    expect(() => validateCustomizationName('')).toThrow(DomainError);
  });

  it('rejects strings longer than 64 characters', () => {
    expect(() => validateCustomizationName('a'.repeat(65))).toThrow(DomainError);
  });

  it('rejects leading hyphen', () => {
    expect(() => validateCustomizationName('-skill')).toThrow(DomainError);
  });

  it('rejects trailing hyphen', () => {
    expect(() => validateCustomizationName('skill-')).toThrow(DomainError);
  });

  it('includes invalid: ["name"] in DomainError details', () => {
    try {
      validateCustomizationName('Bad Name');
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).details).toEqual({ invalid: ['name'] });
    }
  });
});
