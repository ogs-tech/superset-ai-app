import { describe, expect, it } from 'vitest';
import { normalizeGitUrl, pluginSource } from '../../../src/main/domain/plugin-source.js';

describe('normalizeGitUrl', () => {
  it('converts GitHub shorthand to HTTPS URL', () => {
    expect(normalizeGitUrl('owner/repo')).toBe('https://github.com/owner/repo.git');
  });

  it('adds .git to HTTPS GitHub URL without it', () => {
    expect(normalizeGitUrl('https://github.com/owner/repo')).toBe(
      'https://github.com/owner/repo.git',
    );
  });

  it('leaves HTTPS GitHub URL with .git unchanged', () => {
    expect(normalizeGitUrl('https://github.com/owner/repo.git')).toBe(
      'https://github.com/owner/repo.git',
    );
  });

  it('leaves non-GitHub HTTPS URLs unchanged', () => {
    expect(normalizeGitUrl('https://gitlab.com/owner/repo')).toBe('https://gitlab.com/owner/repo');
  });

  it('leaves SSH URLs unchanged', () => {
    expect(normalizeGitUrl('git@github.com:owner/repo.git')).toBe('git@github.com:owner/repo.git');
  });

  it('leaves other SSH URLs unchanged', () => {
    expect(normalizeGitUrl('git@gitlab.com:owner/repo.git')).toBe('git@gitlab.com:owner/repo.git');
  });
});

describe('pluginSource', () => {
  it('creates PluginSource with normalized URL', () => {
    expect(pluginSource('owner/repo')).toEqual({
      kind: 'git',
      url: 'https://github.com/owner/repo.git',
    });
  });

  it('includes ref when provided', () => {
    const mockRef = { kind: 'branch' as const, value: 'main' };
    expect(pluginSource('owner/repo', mockRef)).toEqual({
      kind: 'git',
      url: 'https://github.com/owner/repo.git',
      ref: mockRef,
    });
  });

  it('omits ref when not provided', () => {
    const result = pluginSource('owner/repo');
    expect(result).not.toHaveProperty('ref');
  });
});
