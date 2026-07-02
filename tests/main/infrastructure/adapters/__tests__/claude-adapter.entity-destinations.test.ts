import { describe, it, expect } from 'vitest';
import { ClaudeAdapter } from '../../../../../src/main/infrastructure/adapters/claude-adapter.js';
import { WORKSPACE_SOURCE, type Skill, type Instruction } from '../../../../../src/shared/entity.js';

const meta = { version: '0.1.0', createdAt: '', updatedAt: '' };
const adapter = new ClaudeAdapter({ homedir: '/home/u' });

describe('ClaudeAdapter.resolveEntityDestinations', () => {
  it('routes a personal skill to ~/.claude/skills/<name>', () => {
    const skill: Skill = { urn: 'urn:skill:demo', kind: 'skill', name: 'demo', description: 'd',
      scopes: ['personal'], metadata: meta, source: WORKSPACE_SOURCE, content: 'b' };
    expect(adapter.resolveEntityDestinations({ entity: skill, linkedRepos: [] })).toEqual([
      { scope: 'personal', destination: '/home/u/.claude/skills/demo' },
    ]);
  });

  it('routes an instruction to BOTH CLAUDE.md and AGENTS.md', () => {
    const ins: Instruction = { urn: 'urn:instruction:default', kind: 'instruction', name: 'default',
      description: '', scopes: ['personal'], metadata: meta, source: WORKSPACE_SOURCE, content: 'b', activation: 'always' };
    expect(adapter.resolveEntityDestinations({ entity: ins, linkedRepos: [] })).toEqual([
      { scope: 'personal', destination: '/home/u/.claude/CLAUDE.md' },
      { scope: 'personal', destination: '/home/u/AGENTS.md' },
    ]);
  });
});
