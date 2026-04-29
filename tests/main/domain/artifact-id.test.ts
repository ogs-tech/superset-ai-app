import { describe, expect, it } from 'vitest';
import {
  formatArtifactId,
  parseArtifactId,
} from '../../../src/main/domain/artifact-id.js';
import { DomainError } from '../../../src/main/domain/errors.js';

describe('parseArtifactId', () => {
  it('parses skill/<name>', () => {
    expect(parseArtifactId('skill/foo')).toEqual({ type: 'skill', name: 'foo' });
  });

  it('parses reference/<name>', () => {
    expect(parseArtifactId('reference/bar')).toEqual({ type: 'reference', name: 'bar' });
  });

  it('parses agent/<name>', () => {
    expect(parseArtifactId('agent/baz')).toEqual({ type: 'agent', name: 'baz' });
  });

  it('preserves dashes inside name', () => {
    expect(parseArtifactId('skill/foo-bar-baz')).toEqual({
      type: 'skill',
      name: 'foo-bar-baz',
    });
  });

  it('rejects ids without a slash with kind=validation', () => {
    expect(() => parseArtifactId('foo')).toThrowError(DomainError);
    try {
      parseArtifactId('foo');
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).kind).toBe('validation');
    }
  });

  it('rejects ids with unknown type with kind=validation', () => {
    expect(() => parseArtifactId('unknown/foo')).toThrowError(DomainError);
    try {
      parseArtifactId('unknown/foo');
    } catch (err) {
      expect((err as DomainError).kind).toBe('validation');
    }
  });

  it('rejects ids with empty name', () => {
    expect(() => parseArtifactId('skill/')).toThrowError(DomainError);
  });

  it('rejects ids with invalid name (uppercase)', () => {
    expect(() => parseArtifactId('skill/FooBar')).toThrowError(DomainError);
    try {
      parseArtifactId('skill/FooBar');
    } catch (err) {
      expect((err as DomainError).kind).toBe('validation');
    }
  });

  it('rejects ids with invalid name (spaces)', () => {
    expect(() => parseArtifactId('skill/foo bar')).toThrowError(DomainError);
  });
});

describe('formatArtifactId', () => {
  it('joins type and name with /', () => {
    expect(formatArtifactId('skill', 'foo')).toBe('skill/foo');
    expect(formatArtifactId('reference', 'bar')).toBe('reference/bar');
    expect(formatArtifactId('agent', 'baz-qux')).toBe('agent/baz-qux');
  });
});
