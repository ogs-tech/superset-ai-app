import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { ClaudeAdapter } from '../../../../../src/main/infrastructure/adapters/claude-adapter.js';
import type { Artifact } from '../../../../../src/shared/artifact.js';

const HOMEDIR = '/Users/alice';

const globalInstructionArtifact = (slug: 'claude' | 'copilot'): Artifact => ({
  id: `global-instruction/${slug}`,
  frontmatter: {
    name: slug,
    type: 'global-instruction',
    description: 'global instruction',
    scopes: ['personal'],
    version: '0.1.0',
    createdAt: '',
    updatedAt: '',
  },
  body: `# ${slug}\n`,
});

describe('ClaudeAdapter — global-instruction (AC#6, AC#7)', () => {
  it('resolves slug "claude" to <homedir>/.claude/CLAUDE.md', () => {
    const adapter = new ClaudeAdapter({ homedir: HOMEDIR });
    const destinations = adapter.resolveDestinations({
      artifact: globalInstructionArtifact('claude'),
      linkedRepos: [],
    });

    expect(destinations).toEqual([
      { scope: 'personal', destination: join(HOMEDIR, '.claude/CLAUDE.md') },
    ]);
  });

  it('returns [] for slug "copilot" (Claude adapter ignores it)', () => {
    const adapter = new ClaudeAdapter({ homedir: HOMEDIR });
    const destinations = adapter.resolveDestinations({
      artifact: globalInstructionArtifact('copilot'),
      linkedRepos: [],
    });

    expect(destinations).toEqual([]);
  });

  it('all returned destinations are absolute (AC#16)', () => {
    const adapter = new ClaudeAdapter({ homedir: HOMEDIR });
    const destinations = adapter.resolveDestinations({
      artifact: globalInstructionArtifact('claude'),
      linkedRepos: [],
    });

    for (const d of destinations) {
      expect(d.destination.startsWith('/')).toBe(true);
    }
  });
});
