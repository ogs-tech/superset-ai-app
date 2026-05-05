import { describe, it, expect } from 'vitest';
import {
  referenceId,
  tryReferenceId,
  isValidReferenceId,
  ReferenceIdInvalidError,
} from '../../../src/main/domain/reference-id.js';

describe('ReferenceId', () => {
  describe('referenceId()', () => {
    it('accepts valid IDs', () => {
      ['style-guide', 'foo', 'api-v2'].forEach((id) =>
        expect(referenceId(id)).toBe(id),
      );
    });

    it('rejects empty', () => {
      expect(() => referenceId('')).toThrow(ReferenceIdInvalidError);
    });

    it('rejects uppercase', () => {
      expect(() => referenceId('StyleGuide')).toThrow(ReferenceIdInvalidError);
    });

    it('rejects trailing hyphen', () => {
      expect(() => referenceId('style-')).toThrow(ReferenceIdInvalidError);
    });
  });

  describe('tryReferenceId()', () => {
    it('returns ok for valid', () => {
      expect(tryReferenceId('foo').ok).toBe(true);
    });

    it('returns error for invalid', () => {
      const r = tryReferenceId('Bad');
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toBeInstanceOf(ReferenceIdInvalidError);
    });
  });

  describe('isValidReferenceId()', () => {
    it('discriminates', () => {
      expect(isValidReferenceId('foo')).toBe(true);
      expect(isValidReferenceId('Foo')).toBe(false);
    });
  });
});
