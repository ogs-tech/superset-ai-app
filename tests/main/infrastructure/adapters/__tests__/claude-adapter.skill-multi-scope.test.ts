import { describe, expect, it } from 'vitest';
import { ClaudeAdapter } from '../../../../../src/main/infrastructure/adapters/claude-adapter.js';
import type { Artifact } from '../../../../../src/shared/artifact.js';
import type { LinkedRepo } from '../../../../../src/shared/settings.js';

const skill = (scopes: Array<'personal' | 'project'>): Artifact => ({
  id: 'skill/multi',
  frontmatter: {
    name: 'multi',
    type: 'skill',
    description: 'desc',
    scopes,
    version: '1.0.0',
    createdAt: '',
    updatedAt: '',
  },
  body: '# multi',
});

const linkedRepos: LinkedRepo[] = [
  { id: 'r1', name: 'app', path: '/repos/app' },
  { id: 'r2', name: 'lib', path: '/repos/lib' },
];

describe('ClaudeAdapter — skill with multiple scopes', () => {
  it('returns the union of personal + per-repo destinations when scopes = [personal, project]', () => {
    const adapter = new ClaudeAdapter({ homedir: '/Users/alice' });

    const destinations = adapter.resolveDestinations({
      artifact: skill(['personal', 'project']),
      linkedRepos,
    });

    expect(destinations).toEqual([
      { scope: 'personal', destination: '/Users/alice/.claude/skills/multi' },
      { scope: 'project', destination: '/repos/app/.claude/skills/multi' },
      { scope: 'project', destination: '/repos/lib/.claude/skills/multi' },
    ]);
  });

  it('returns only personal destinations when scopes = [personal]', () => {
    const adapter = new ClaudeAdapter({ homedir: '/Users/alice' });

    const destinations = adapter.resolveDestinations({
      artifact: skill(['personal']),
      linkedRepos,
    });

    expect(destinations).toEqual([
      { scope: 'personal', destination: '/Users/alice/.claude/skills/multi' },
    ]);
  });

  it('returns only per-repo destinations when scopes = [project]', () => {
    const adapter = new ClaudeAdapter({ homedir: '/Users/alice' });

    const destinations = adapter.resolveDestinations({
      artifact: skill(['project']),
      linkedRepos,
    });

    expect(destinations).toEqual([
      { scope: 'project', destination: '/repos/app/.claude/skills/multi' },
      { scope: 'project', destination: '/repos/lib/.claude/skills/multi' },
    ]);
  });
});
