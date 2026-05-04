import { describe, expect, it } from 'vitest';
import {
  formatCustomizationId,
  parseCustomizationId,
} from '../../../src/main/domain/customization-id.js';
import { DomainError } from '../../../src/main/domain/errors.js';

describe('parseCustomizationId', () => {
  it('parses skill/<name>', () => {
    expect(parseCustomizationId('skill/foo')).toEqual({ type: 'skill', name: 'foo' });
  });

  it('parses reference/<name>', () => {
    expect(parseCustomizationId('reference/bar')).toEqual({ type: 'reference', name: 'bar' });
  });

  it('parses agent/<name>', () => {
    expect(parseCustomizationId('agent/baz')).toEqual({ type: 'agent', name: 'baz' });
  });

  it('preserves dashes inside name', () => {
    expect(parseCustomizationId('skill/foo-bar-baz')).toEqual({
      type: 'skill',
      name: 'foo-bar-baz',
    });
  });

  it('rejects ids without a slash with kind=validation', () => {
    expect(() => parseCustomizationId('foo')).toThrowError(DomainError);
    try {
      parseCustomizationId('foo');
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).kind).toBe('validation');
    }
  });

  it('rejects ids with unknown type with kind=validation', () => {
    expect(() => parseCustomizationId('unknown/foo')).toThrowError(DomainError);
    try {
      parseCustomizationId('unknown/foo');
    } catch (err) {
      expect((err as DomainError).kind).toBe('validation');
    }
  });

  it('rejects ids with empty name', () => {
    expect(() => parseCustomizationId('skill/')).toThrowError(DomainError);
  });

  it('rejects ids with invalid name (uppercase)', () => {
    expect(() => parseCustomizationId('skill/FooBar')).toThrowError(DomainError);
    try {
      parseCustomizationId('skill/FooBar');
    } catch (err) {
      expect((err as DomainError).kind).toBe('validation');
    }
  });

  it('rejects ids with invalid name (spaces)', () => {
    expect(() => parseCustomizationId('skill/foo bar')).toThrowError(DomainError);
  });
});

describe('formatCustomizationId', () => {
  it('joins type and name with /', () => {
    expect(formatCustomizationId('skill', 'foo')).toBe('skill/foo');
    expect(formatCustomizationId('reference', 'bar')).toBe('reference/bar');
    expect(formatCustomizationId('agent', 'baz-qux')).toBe('agent/baz-qux');
  });
});
