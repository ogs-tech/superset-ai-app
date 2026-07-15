import { describe, it, expect } from 'vitest';
import { ClaudeAdapter } from '../../../../../src/main/infrastructure/adapters/claude-adapter.js';
import {
  WORKSPACE_SOURCE,
  type Agent,
  type PersonalInstruction,
  type ProjectInstruction,
  type Skill,
} from '../../../../../src/shared/entity.js';

const meta = { version: '0.1.0', createdAt: '', updatedAt: '' };
const adapter = new ClaudeAdapter({ homedir: '/home/u' });

describe('ClaudeAdapter.resolveEntityDestinations', () => {
  it('routes a personal skill to ~/.claude/skills/<name>', () => {
    const skill: Skill = { urn: 'urn:skill:demo', kind: 'skill', name: 'demo', description: 'd',
      scopes: ['personal'], metadata: meta, source: WORKSPACE_SOURCE, content: 'b' };
    expect(adapter.resolveEntityDestinations({ entity: skill })).toEqual([
      { scope: 'personal', destination: '/home/u/.claude/skills/demo', strategy: 'symlink' },
    ]);
  });

  it('fans the personal instruction out to both ~/.claude/CLAUDE.md and ~/AGENTS.md', () => {
    const ins: PersonalInstruction = {
      urn: 'urn:instruction:default', kind: 'instruction', name: 'default',
      description: '', scopes: ['personal'], metadata: meta,
      source: WORKSPACE_SOURCE, content: 'body',
    };
    expect(adapter.resolveEntityDestinations({ entity: ins })).toEqual([
      { scope: 'personal', destination: '/home/u/.claude/CLAUDE.md', strategy: 'symlink' },
      { scope: 'personal', destination: '/home/u/AGENTS.md', strategy: 'symlink' },
    ]);
  });

  it('drops project-scoped skill/agent destinations while linkedRepos is being replaced', () => {
    const skill: Skill = { urn: 'urn:skill:multi', kind: 'skill', name: 'multi', description: 'd',
      scopes: ['personal', 'project'], metadata: meta, source: WORKSPACE_SOURCE, content: 'b' };
    expect(adapter.resolveEntityDestinations({ entity: skill })).toEqual([
      { scope: 'personal', destination: '/home/u/.claude/skills/multi', strategy: 'symlink' },
    ]);
  });

  it('returns [] for a project-only agent (linkedRepos gone; no per-agent repoPath yet)', () => {
    const agent: Agent = { urn: 'urn:agent:triage', kind: 'agent', name: 'triage', description: 'd',
      scopes: ['project'], metadata: meta, source: WORKSPACE_SOURCE, systemPrompt: 'b' };
    expect(adapter.resolveEntityDestinations({ entity: agent })).toEqual([]);
  });

  it('routes a project instruction to <entity.repoPath>/{.claude/CLAUDE.md, AGENTS.md}', () => {
    const ins: ProjectInstruction = {
      urn: 'urn:instruction:acme', kind: 'instruction', name: 'acme',
      description: '', scopes: ['project'], metadata: meta,
      source: WORKSPACE_SOURCE, content: 'body',
      repoPath: '/repos/acme',
    };
    expect(adapter.resolveEntityDestinations({ entity: ins })).toEqual([
      { scope: 'project', destination: '/repos/acme/.claude/CLAUDE.md', strategy: 'symlink' },
      { scope: 'project', destination: '/repos/acme/AGENTS.md', strategy: 'symlink' },
    ]);
  });

  it('preserves non-ASCII / spaced paths as-is', () => {
    const accented = new ClaudeAdapter({ homedir: '/Users/José Silva' });
    const skill: Skill = { urn: 'urn:skill:review', kind: 'skill', name: 'review', description: 'd',
      scopes: ['personal'], metadata: meta, source: WORKSPACE_SOURCE, content: 'b' };
    const [personal] = accented.resolveEntityDestinations({ entity: skill });
    expect(personal?.destination).toBe('/Users/José Silva/.claude/skills/review');

    const ins: ProjectInstruction = {
      urn: 'urn:instruction:acme', kind: 'instruction', name: 'acme',
      description: '', scopes: ['project'], metadata: meta,
      source: WORKSPACE_SOURCE, content: 'body',
      repoPath: '/Users/x/My Repo (work)',
    };
    const [claudeMd] = accented.resolveEntityDestinations({ entity: ins });
    expect(claudeMd?.destination).toBe('/Users/x/My Repo (work)/.claude/CLAUDE.md');
  });
});
