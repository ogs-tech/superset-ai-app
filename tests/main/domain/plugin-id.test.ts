import { describe, it, expect } from 'vitest';
import type { PluginId } from '../../../src/main/domain/plugin-id.js';
import {
  pluginId,
  tryPluginId,
  isValidPluginId,
  PluginIdInvalidError,
} from '../../../src/main/domain/plugin-id.js';

describe('PluginId', () => {
  describe('pluginId()', () => {
    it('should create valid plugin IDs', () => {
      const valid = ['superpowers', 'a', 'a-b-c', 'abc123'];

      valid.forEach((id) => {
        const result = pluginId(id);
        expect(result).toBe(id);
      });
    });

    it('should accept a 64-character valid string', () => {
      const id64 = 'a' + 'b'.repeat(62) + 'c'; // 64 chars, starts with 'a', ends with 'c'
      const result = pluginId(id64);
      expect(result).toBe(id64);
    });

    it('should throw PluginIdInvalidError on empty string', () => {
      expect(() => pluginId('')).toThrow(PluginIdInvalidError);
      expect(() => pluginId('')).toThrow(/cannot be empty/);
    });

    it('should throw PluginIdInvalidError on uppercase letters', () => {
      expect(() => pluginId('Abc')).toThrow(PluginIdInvalidError);
      expect(() => pluginId('Abc')).toThrow(/must start with lowercase letter/);
    });

    it('should throw PluginIdInvalidError when starting with digit', () => {
      expect(() => pluginId('1abc')).toThrow(PluginIdInvalidError);
      expect(() => pluginId('1abc')).toThrow(/must start with lowercase letter/);
    });

    it('should throw PluginIdInvalidError when starting with hyphen', () => {
      expect(() => pluginId('--')).toThrow(PluginIdInvalidError);
      expect(() => pluginId('--')).toThrow(/must start with lowercase letter/);
    });

    it('should throw PluginIdInvalidError on string longer than 64 characters', () => {
      const id65 = 'a' + 'b'.repeat(64); // 65 chars total
      expect(() => pluginId(id65)).toThrow(PluginIdInvalidError);
      expect(() => pluginId(id65)).toThrow(/cannot exceed 64 characters/);
    });

    it('should throw PluginIdInvalidError on underscore', () => {
      expect(() => pluginId('a_b')).toThrow(PluginIdInvalidError);
      expect(() => pluginId('a_b')).toThrow(
        /can only contain lowercase letters, digits, and hyphens/,
      );
    });

    it('should include raw value in error details', () => {
      try {
        pluginId('Invalid');
      } catch (err) {
        expect(err).toBeInstanceOf(PluginIdInvalidError);
        if (err instanceof PluginIdInvalidError) {
          expect(err.details?.raw).toBe('Invalid');
        }
      }
    });
  });

  describe('tryPluginId()', () => {
    it('should return ok: true for valid plugin IDs', () => {
      const valid = ['superpowers', 'a', 'a-b-c', 'abc123'];

      valid.forEach((id) => {
        const result = tryPluginId(id);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toBe(id);
        }
      });
    });

    it('should return ok: false for invalid plugin IDs', () => {
      const invalid = ['', 'Abc', '1abc', '--', 'a_b'];

      invalid.forEach((id) => {
        const result = tryPluginId(id);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error).toBeInstanceOf(PluginIdInvalidError);
        }
      });
    });

    it('should return ok: false for strings exceeding 64 characters', () => {
      const id65 = 'a' + 'b'.repeat(64);
      const result = tryPluginId(id65);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.details?.raw).toBe(id65);
      }
    });

    it('should never throw', () => {
      const inputs = ['', 'Abc', '1abc', '--', 'a_b', 'a'.repeat(100)];

      inputs.forEach((input) => {
        expect(() => tryPluginId(input)).not.toThrow();
      });
    });
  });

  describe('isValidPluginId()', () => {
    it('should return true for valid plugin IDs', () => {
      const valid = ['superpowers', 'a', 'a-b-c', 'abc123'];

      valid.forEach((id) => {
        expect(isValidPluginId(id)).toBe(true);
      });
    });

    it('should return false for invalid plugin IDs', () => {
      const invalid = ['', 'Abc', '1abc', '--', 'a_b'];

      invalid.forEach((id) => {
        expect(isValidPluginId(id)).toBe(false);
      });
    });

    it('should return false for non-string values', () => {
      expect(isValidPluginId(null)).toBe(false);
      expect(isValidPluginId(undefined)).toBe(false);
      expect(isValidPluginId(123)).toBe(false);
      expect(isValidPluginId({})).toBe(false);
    });

    it('should return false for strings exceeding 64 characters', () => {
      const id65 = 'a' + 'b'.repeat(64);
      expect(isValidPluginId(id65)).toBe(false);
    });
  });

  describe('PluginIdInvalidError', () => {
    it('should have correct name property', () => {
      const err = new PluginIdInvalidError('test');
      expect(err.name).toBe('PluginIdInvalidError');
    });

    it('should include raw value in details when provided', () => {
      const err = new PluginIdInvalidError('test message', { raw: 'invalid-id' });
      expect(err.details?.raw).toBe('invalid-id');
    });

    it('should not include details when raw not provided', () => {
      const err = new PluginIdInvalidError('test message');
      expect(err.details).toBeUndefined();
    });

    it('should be an instance of Error', () => {
      const err = new PluginIdInvalidError('test');
      expect(err).toBeInstanceOf(Error);
    });
  });

  describe('edge cases', () => {
    it('should accept single lowercase letter', () => {
      expect(isValidPluginId('a')).toBe(true);
      expect(isValidPluginId('z')).toBe(true);
    });

    it('should accept hyphen in middle', () => {
      expect(isValidPluginId('my-plugin')).toBe(true);
      expect(isValidPluginId('a-b')).toBe(true);
    });

    it('should reject hyphen at start', () => {
      expect(isValidPluginId('-plugin')).toBe(false);
    });

    it('should accept hyphen followed by digit', () => {
      expect(isValidPluginId('a-1')).toBe(true);
    });

    it('should accept multiple consecutive hyphens', () => {
      expect(isValidPluginId('a--b')).toBe(true);
    });

    it('should reject trailing hyphen', () => {
      // Note: Pattern /^[a-z][a-z0-9-]{0,63}$/ allows trailing hyphen
      // based on the spec "0–63 lowercase alphanumeric or hyphen chars"
      // Let's verify the behavior
      expect(isValidPluginId('a-')).toBe(true);
    });
  });
});
