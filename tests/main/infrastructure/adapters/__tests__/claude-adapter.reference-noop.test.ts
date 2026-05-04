import { describe, expect, it } from 'vitest';
import { ClaudeAdapter } from '../../../../../src/main/infrastructure/adapters/claude-adapter.js';
import type { Customization, CustomizationScope } from '../../../../../src/shared/customization.js';
import type { LinkedRepo } from '../../../../../src/shared/settings.js';

const reference = (scope: CustomizationScope): Customization => ({
  id: 'reference/style-guide',
  frontmatter: {
    name: 'style-guide',
    type: 'reference',
    description: 'desc',
    scopes: [scope],
    version: '1.0.0',
    createdAt: '',
    updatedAt: '',
  },
  body: '# style',
});

const repos: LinkedRepo[] = [
  { id: 'r1', name: 'r1', path: '/r1' },
  { id: 'r2', name: 'r2', path: '/r2' },
];

describe('ClaudeAdapter — reference (no-op)', () => {
  it.each<[CustomizationScope, LinkedRepo[]]>([
    ['personal', []],
    ['personal', repos],
    ['project', []],
    ['project', repos],
  ])('returns [] for reference (scope=%s, linkedRepos.length=%i)', (scope, linkedRepos) => {
    const adapter = new ClaudeAdapter({ homedir: '/Users/alice' });

    const destinations = adapter.resolveDestinations({
      customization: reference(scope),
      linkedRepos,
    });

    expect(destinations).toEqual([]);
  });
});
