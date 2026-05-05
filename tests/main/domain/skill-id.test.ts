import { describe, it, expect } from 'vitest';
import {
  skillId,
  trySkillId,
  isValidSkillId,
  SkillIdInvalidError,
} from '../../../src/main/domain/skill-id.js';

describe('SkillId', () => {
  describe('skillId()', () => {
    it('accepts valid IDs', () => {
      ['foo', 'a', 'a-b-c', 'abc123', '0name', 'a-1', 'a--b'].forEach((id) => {
        expect(skillId(id)).toBe(id);
      });
    });

    it('accepts a 64-character valid string', () => {
      const id64 = 'a' + 'b'.repeat(62) + 'c';
      expect(skillId(id64)).toBe(id64);
    });

    it('rejects empty string', () => {
      expect(() => skillId('')).toThrow(SkillIdInvalidError);
      expect(() => skillId('')).toThrow(/cannot be empty/);
    });

    it('rejects uppercase letters', () => {
      expect(() => skillId('Foo')).toThrow(SkillIdInvalidError);
    });

    it('rejects leading hyphen', () => {
      expect(() => skillId('-foo')).toThrow(SkillIdInvalidError);
    });

    it('rejects trailing hyphen', () => {
      expect(() => skillId('foo-')).toThrow(SkillIdInvalidError);
      expect(() => skillId('foo-')).toThrow(/cannot end with hyphen/);
    });

    it('rejects underscore', () => {
      expect(() => skillId('a_b')).toThrow(SkillIdInvalidError);
    });

    it('rejects strings longer than 64 chars', () => {
      const id65 = 'a' + 'b'.repeat(64);
      expect(() => skillId(id65)).toThrow(SkillIdInvalidError);
      expect(() => skillId(id65)).toThrow(/cannot exceed 64 characters/);
    });

    it('includes raw value in error details', () => {
      try {
        skillId('Bad');
      } catch (err) {
        expect(err).toBeInstanceOf(SkillIdInvalidError);
        if (err instanceof SkillIdInvalidError) {
          expect(err.details?.raw).toBe('Bad');
        }
      }
    });
  });

  describe('trySkillId()', () => {
    it('returns ok for valid IDs', () => {
      const r = trySkillId('foo');
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value).toBe('foo');
    });

    it('returns error for invalid IDs', () => {
      ['', 'Foo', '-x', 'x-', 'a_b'].forEach((id) => {
        const r = trySkillId(id);
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error).toBeInstanceOf(SkillIdInvalidError);
      });
    });

    it('never throws', () => {
      ['', 'Foo', 'x_y', 'a'.repeat(100)].forEach((input) => {
        expect(() => trySkillId(input)).not.toThrow();
      });
    });
  });

  describe('isValidSkillId()', () => {
    it('returns true for valid IDs', () => {
      ['foo', 'a', 'a-b-c', '1foo'].forEach((id) => expect(isValidSkillId(id)).toBe(true));
    });

    it('returns false for invalid IDs', () => {
      ['', 'Foo', '-x', 'x-', 'a_b'].forEach((id) => expect(isValidSkillId(id)).toBe(false));
    });

    it('returns false for non-string values', () => {
      expect(isValidSkillId(null)).toBe(false);
      expect(isValidSkillId(undefined)).toBe(false);
      expect(isValidSkillId(123)).toBe(false);
    });
  });
});
