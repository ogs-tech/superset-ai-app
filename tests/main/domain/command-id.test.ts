import { describe, it, expect } from 'vitest';
import {
  commandId,
  tryCommandId,
  isValidCommandId,
  CommandIdInvalidError,
} from '../../../src/main/domain/command-id.js';

describe('CommandId', () => {
  describe('commandId()', () => {
    it('accepts valid IDs', () => {
      ['foo', 'a', 'feature-dev', 'abc123', '0name', 'a-1', 'a--b'].forEach((id) => {
        expect(commandId(id)).toBe(id);
      });
    });

    it('accepts a 64-character valid string', () => {
      const id64 = 'a' + 'b'.repeat(62) + 'c';
      expect(commandId(id64)).toBe(id64);
    });

    it('rejects empty string', () => {
      expect(() => commandId('')).toThrow(CommandIdInvalidError);
      expect(() => commandId('')).toThrow(/cannot be empty/);
    });

    it('rejects uppercase letters', () => {
      expect(() => commandId('Foo')).toThrow(CommandIdInvalidError);
    });

    it('rejects leading hyphen', () => {
      expect(() => commandId('-foo')).toThrow(CommandIdInvalidError);
    });

    it('rejects trailing hyphen', () => {
      expect(() => commandId('foo-')).toThrow(CommandIdInvalidError);
      expect(() => commandId('foo-')).toThrow(/cannot end with hyphen/);
    });

    it('rejects underscore', () => {
      expect(() => commandId('a_b')).toThrow(CommandIdInvalidError);
    });

    it('rejects strings longer than 64 chars', () => {
      const id65 = 'a' + 'b'.repeat(64);
      expect(() => commandId(id65)).toThrow(CommandIdInvalidError);
      expect(() => commandId(id65)).toThrow(/cannot exceed 64 characters/);
    });

    it('includes raw value in error details', () => {
      try {
        commandId('Bad');
      } catch (err) {
        expect(err).toBeInstanceOf(CommandIdInvalidError);
        if (err instanceof CommandIdInvalidError) {
          expect(err.details?.raw).toBe('Bad');
        }
      }
    });
  });

  describe('tryCommandId()', () => {
    it('returns ok for valid IDs', () => {
      const r = tryCommandId('feature-dev');
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value).toBe('feature-dev');
    });

    it('returns error for invalid IDs', () => {
      ['', 'Foo', '-x', 'x-', 'a_b'].forEach((id) => {
        const r = tryCommandId(id);
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error).toBeInstanceOf(CommandIdInvalidError);
      });
    });

    it('never throws', () => {
      ['', 'Foo', 'x_y', 'a'.repeat(100)].forEach((input) => {
        expect(() => tryCommandId(input)).not.toThrow();
      });
    });
  });

  describe('isValidCommandId()', () => {
    it('returns true for valid IDs', () => {
      ['foo', 'a', 'feature-dev', '1foo'].forEach((id) => expect(isValidCommandId(id)).toBe(true));
    });

    it('returns false for invalid IDs', () => {
      ['', 'Foo', '-x', 'x-', 'a_b'].forEach((id) => expect(isValidCommandId(id)).toBe(false));
    });

    it('returns false for non-string values', () => {
      expect(isValidCommandId(null)).toBe(false);
      expect(isValidCommandId(undefined)).toBe(false);
      expect(isValidCommandId(123)).toBe(false);
    });
  });
});
