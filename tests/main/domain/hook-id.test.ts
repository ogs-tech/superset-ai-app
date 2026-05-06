import { describe, it, expect } from 'vitest';
import { hookId, tryHookId, isValidHookId, HookIdInvalidError } from '../../../src/main/domain/hook-id.js';

describe('HookId', () => {
  it('accepts uuid v4 format', () => {
    const u = '550e8400-e29b-41d4-a716-446655440000';
    expect(hookId(u)).toBe(u);
  });

  it('accepts plugin-derived synthetic ids with colons', () => {
    expect(hookId('superpowers:SessionStart:0:0')).toBe('superpowers:SessionStart:0:0');
  });

  it('accepts uppercase letters (event names are CamelCase)', () => {
    expect(hookId('foo:PreToolUse:1')).toBe('foo:PreToolUse:1');
  });

  it('rejects empty string', () => {
    expect(() => hookId('')).toThrow(HookIdInvalidError);
  });

  it('rejects whitespace', () => {
    expect(() => hookId('a b')).toThrow(HookIdInvalidError);
  });

  it('rejects strings longer than 128 chars', () => {
    expect(() => hookId('a'.repeat(129))).toThrow(HookIdInvalidError);
  });

  it('tryHookId returns ok for valid input', () => {
    const r = tryHookId('abc');
    expect(r.ok).toBe(true);
  });

  it('tryHookId returns error for invalid input', () => {
    const r = tryHookId('');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBeInstanceOf(HookIdInvalidError);
  });

  it('isValidHookId discriminates correctly', () => {
    expect(isValidHookId('abc')).toBe(true);
    expect(isValidHookId('')).toBe(false);
    expect(isValidHookId(null)).toBe(false);
    expect(isValidHookId(123)).toBe(false);
  });
});
