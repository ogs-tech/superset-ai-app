import { describe, it, expect } from 'vitest';
import {
  PluginRefInvalidError,
  pluginRefBranch,
  pluginRefTag,
  pluginRefSha,
  isPluginRef,
  parsePluginRef,
} from '../../../src/main/domain/plugin-ref.js';

describe('pluginRefBranch', () => {
  it('creates a valid branch PluginRef', () => {
    const ref = pluginRefBranch('main');
    expect(ref).toEqual({ kind: 'branch', value: 'main' });
  });

  it('throws when value is empty', () => {
    expect(() => pluginRefBranch('')).toThrow(PluginRefInvalidError);
    expect(() => pluginRefBranch('')).toThrow('Branch value cannot be empty');
  });
});

describe('pluginRefTag', () => {
  it('creates a valid tag PluginRef', () => {
    const ref = pluginRefTag('v1.0.0');
    expect(ref).toEqual({ kind: 'tag', value: 'v1.0.0' });
  });

  it('throws when value is empty', () => {
    expect(() => pluginRefTag('')).toThrow(PluginRefInvalidError);
    expect(() => pluginRefTag('')).toThrow('Tag value cannot be empty');
  });
});

describe('pluginRefSha', () => {
  it('creates a valid SHA PluginRef', () => {
    const ref = pluginRefSha('a1b2c3d4e5f6');
    expect(ref).toEqual({ kind: 'sha', value: 'a1b2c3d4e5f6' });
  });

  it('accepts uppercase hexadecimal', () => {
    const ref = pluginRefSha('A1B2C3D4E5F6');
    expect(ref).toEqual({ kind: 'sha', value: 'A1B2C3D4E5F6' });
  });

  it('accepts mixed case hexadecimal', () => {
    const ref = pluginRefSha('aAbBcCdDeEfF');
    expect(ref).toEqual({ kind: 'sha', value: 'aAbBcCdDeEfF' });
  });

  it('throws when value is empty', () => {
    expect(() => pluginRefSha('')).toThrow(PluginRefInvalidError);
    expect(() => pluginRefSha('')).toThrow('SHA value cannot be empty');
  });

  it('throws when value is not hexadecimal', () => {
    expect(() => pluginRefSha('xyz123')).toThrow(PluginRefInvalidError);
    expect(() => pluginRefSha('xyz123')).toThrow('SHA value must be hexadecimal');
  });

  it('throws when value contains non-hex characters', () => {
    expect(() => pluginRefSha('g1h2i3j4')).toThrow(PluginRefInvalidError);
    expect(() => pluginRefSha('g1h2i3j4')).toThrow('SHA value must be hexadecimal');
  });
});

describe('isPluginRef', () => {
  it('returns true for valid branch ref', () => {
    expect(isPluginRef({ kind: 'branch', value: 'main' })).toBe(true);
  });

  it('returns true for valid tag ref', () => {
    expect(isPluginRef({ kind: 'tag', value: 'v1.0.0' })).toBe(true);
  });

  it('returns true for valid sha ref', () => {
    expect(isPluginRef({ kind: 'sha', value: 'a1b2c3d4e5f6' })).toBe(true);
  });

  it('returns false for null', () => {
    expect(isPluginRef(null)).toBe(false);
  });

  it('returns false for string', () => {
    expect(isPluginRef('main')).toBe(false);
  });

  it('returns false for number', () => {
    expect(isPluginRef(42)).toBe(false);
  });

  it('returns false for missing kind', () => {
    expect(isPluginRef({ value: 'main' })).toBe(false);
  });

  it('returns false for missing value', () => {
    expect(isPluginRef({ kind: 'branch' })).toBe(false);
  });

  it('returns false for non-string value', () => {
    expect(isPluginRef({ kind: 'branch', value: 123 })).toBe(false);
  });

  it('returns false for unknown kind', () => {
    expect(isPluginRef({ kind: 'unknown', value: 'test' })).toBe(false);
  });

  it('returns false for empty object', () => {
    expect(isPluginRef({})).toBe(false);
  });
});

describe('parsePluginRef', () => {
  it('parses valid branch ref', () => {
    const ref = parsePluginRef({ kind: 'branch', value: 'main' });
    expect(ref).toEqual({ kind: 'branch', value: 'main' });
  });

  it('parses valid tag ref', () => {
    const ref = parsePluginRef({ kind: 'tag', value: 'v1.0.0' });
    expect(ref).toEqual({ kind: 'tag', value: 'v1.0.0' });
  });

  it('parses valid sha ref', () => {
    const ref = parsePluginRef({ kind: 'sha', value: 'a1b2c3d4e5f6' });
    expect(ref).toEqual({ kind: 'sha', value: 'a1b2c3d4e5f6' });
  });

  it('throws PluginRefInvalidError with raw details on invalid input', () => {
    const raw = { kind: 'invalid', value: 'test' };
    expect(() => parsePluginRef(raw)).toThrow(PluginRefInvalidError);
    try {
      parsePluginRef(raw);
    } catch (error) {
      if (error instanceof PluginRefInvalidError) {
        expect(error.details?.raw).toEqual(raw);
      }
    }
  });

  it('throws on invalid kind', () => {
    expect(() => parsePluginRef({ kind: 'invalid', value: 'test' })).toThrow(PluginRefInvalidError);
  });

  it('throws on empty branch value', () => {
    expect(() => parsePluginRef({ kind: 'branch', value: '' })).toThrow(PluginRefInvalidError);
  });

  it('throws on empty tag value', () => {
    expect(() => parsePluginRef({ kind: 'tag', value: '' })).toThrow(PluginRefInvalidError);
  });

  it('throws on empty sha value', () => {
    expect(() => parsePluginRef({ kind: 'sha', value: '' })).toThrow(PluginRefInvalidError);
  });

  it('throws on non-hex sha', () => {
    expect(() => parsePluginRef({ kind: 'sha', value: 'xyz123' })).toThrow(PluginRefInvalidError);
  });

  it('throws PluginRefInvalidError on null input', () => {
    expect(() => parsePluginRef(null)).toThrow(PluginRefInvalidError);
  });

  it('throws PluginRefInvalidError on string input', () => {
    expect(() => parsePluginRef('main')).toThrow(PluginRefInvalidError);
  });

  it('throws PluginRefInvalidError on missing kind', () => {
    expect(() => parsePluginRef({ value: 'main' })).toThrow(PluginRefInvalidError);
  });

  it('throws PluginRefInvalidError on missing value', () => {
    expect(() => parsePluginRef({ kind: 'branch' })).toThrow(PluginRefInvalidError);
  });
});

describe('PluginRefInvalidError', () => {
  it('has correct name property', () => {
    const error = new PluginRefInvalidError('test');
    expect(error.name).toBe('PluginRefInvalidError');
  });

  it('extends Error', () => {
    const error = new PluginRefInvalidError('test');
    expect(error).toBeInstanceOf(Error);
  });

  it('stores details when provided', () => {
    const raw = { kind: 'test', value: 'value' };
    const error = new PluginRefInvalidError('test', { raw });
    expect(error.details).toEqual({ raw });
  });

  it('has undefined details when not provided', () => {
    const error = new PluginRefInvalidError('test');
    expect(error.details).toBeUndefined();
  });
});
