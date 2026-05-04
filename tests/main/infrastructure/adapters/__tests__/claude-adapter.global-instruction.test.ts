import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { ClaudeAdapter } from '../../../../../src/main/infrastructure/adapters/claude-adapter.js';
import type { Artifact } from '../../../../../src/shared/artifact.js';

const HOMEDIR = '/Users/alice';

const globalInstructionArtifact = (): Artifact => ({
  id: `global-instruction/default`,
  frontmatter: {
    name: 'default',
    type: 'global-instruction',
    description: 'global instruction',
    scopes: ['personal'],
    version: '0.1.0',
    createdAt: '',
    updatedAt: '',
  },
  body: `# global instruction\n`,
});

describe('ClaudeAdapter — global-instruction', () => {
  it('resolves to <homedir>/.claude/CLAUDE.md', () => {
    const adapter = new ClaudeAdapter({ homedir: HOMEDIR });
    const destinations = adapter.resolveDestinations({
      artifact: globalInstructionArtifact(),
      linkedRepos: [],
    });

    expect(destinations).toEqual([
      { scope: 'personal', destination: join(HOMEDIR, '.claude/CLAUDE.md') },
    ]);
  });

  it('all returned destinations are absolute', () => {
    const adapter = new ClaudeAdapter({ homedir: HOMEDIR });
    const destinations = adapter.resolveDestinations({
      artifact: globalInstructionArtifact(),
      linkedRepos: [],
    });

    for (const d of destinations) {
      expect(d.destination.startsWith('/')).toBe(true);
    }
  });
});
