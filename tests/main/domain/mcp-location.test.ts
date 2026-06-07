import { describe, it, expect } from 'vitest';
import {
  type McpLocation,
  locationScope,
  locationRepoPath,
} from '../../../src/main/domain/mcp-location.js';

describe('McpLocation', () => {
  it('maps each kind to its scope tag', () => {
    expect(locationScope({ kind: 'global' })).toBe('global');
    expect(locationScope({ kind: 'project-local', repoPath: '/r' })).toBe('project-local');
    expect(locationScope({ kind: 'project-shared', repoPath: '/r' })).toBe('project-shared');
    expect(locationScope({ kind: 'plugin', pluginId: 'p', pluginDir: '/d' })).toBe('plugin');
    expect(locationScope({ kind: 'detected' })).toBe('detected');
  });

  it('extracts repoPath only for project kinds', () => {
    expect(locationRepoPath({ kind: 'global' })).toBeUndefined();
    expect(locationRepoPath({ kind: 'project-local', repoPath: '/r' })).toBe('/r');
    expect(locationRepoPath({ kind: 'project-shared', repoPath: '/r' })).toBe('/r');
    expect(locationRepoPath({ kind: 'detected' })).toBeUndefined();
  });

  it('satisfies the union exhaustively (compile + runtime)', () => {
    const all: McpLocation[] = [
      { kind: 'global' },
      { kind: 'project-local', repoPath: '/r' },
      { kind: 'project-shared', repoPath: '/r' },
      { kind: 'plugin', pluginId: 'p', pluginDir: '/d' },
      { kind: 'detected' },
    ];
    expect(all.map(locationScope)).toEqual([
      'global',
      'project-local',
      'project-shared',
      'plugin',
      'detected',
    ]);
  });
});
