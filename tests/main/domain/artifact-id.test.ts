import { describe, expect, it } from 'vitest';
import {
  formatArtifactId,
  parseArtifactId,
} from '../../../src/main/domain/artifact-id.js';
import { DomainError } from '../../../src/main/domain/errors.js';

describe('parseArtifactId', () => {
  it('parses skill/<slug>', () => {
    expect(parseArtifactId('skill/foo')).toEqual({ type: 'skill', slug: 'foo' });
  });

  it('parses reference/<slug>', () => {
    expect(parseArtifactId('reference/bar')).toEqual({ type: 'reference', slug: 'bar' });
  });

  it('parses agent/<slug>', () => {
    expect(parseArtifactId('agent/baz')).toEqual({ type: 'agent', slug: 'baz' });
  });

  it('preserves dashes inside slug', () => {
    expect(parseArtifactId('skill/foo-bar-baz')).toEqual({
      type: 'skill',
      slug: 'foo-bar-baz',
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

  it('rejects ids with empty slug', () => {
    expect(() => parseArtifactId('skill/')).toThrowError(DomainError);
  });
});

describe('formatArtifactId', () => {
  it('joins type and slug with /', () => {
    expect(formatArtifactId('skill', 'foo')).toBe('skill/foo');
    expect(formatArtifactId('reference', 'bar')).toBe('reference/bar');
    expect(formatArtifactId('agent', 'baz-qux')).toBe('agent/baz-qux');
  });
});
