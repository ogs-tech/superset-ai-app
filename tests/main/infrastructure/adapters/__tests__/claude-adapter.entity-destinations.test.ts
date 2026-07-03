import { describe, it, expect } from 'vitest';
import { isAbsolute } from 'node:path';
import { ClaudeAdapter } from '../../../../../src/main/infrastructure/adapters/claude-adapter.js';
import { WORKSPACE_SOURCE, type Agent, type Skill, type Instruction } from '../../../../../src/shared/entity.js';
import type { LinkedRepo } from '../../../../../src/shared/settings.js';

const meta = { version: '0.1.0', createdAt: '', updatedAt: '' };
const adapter = new ClaudeAdapter({ homedir: '/home/u' });

describe('ClaudeAdapter.resolveEntityDestinations', () => {
  it('routes a personal skill to ~/.claude/skills/<name>', () => {
    const skill: Skill = { urn: 'urn:skill:demo', kind: 'skill', name: 'demo', description: 'd',
      scopes: ['personal'], metadata: meta, source: WORKSPACE_SOURCE, content: 'b' };
    expect(adapter.resolveEntityDestinations({ entity: skill, linkedRepos: [] })).toEqual([
      { scope: 'personal', destination: '/home/u/.claude/skills/demo', strategy: 'symlink' },
    ]);
  });

  it('routes an instruction to BOTH CLAUDE.md and AGENTS.md', () => {
    const ins: Instruction = { urn: 'urn:instruction:default', kind: 'instruction', name: 'default',
      description: '', scopes: ['personal'], metadata: meta, source: WORKSPACE_SOURCE, content: 'b', activation: 'always' };
    expect(adapter.resolveEntityDestinations({ entity: ins, linkedRepos: [] })).toEqual([
      { scope: 'personal', destination: '/home/u/.claude/CLAUDE.md', strategy: 'symlink' },
      { scope: 'personal', destination: '/home/u/AGENTS.md', strategy: 'symlink' },
    ]);
  });

  it('returns the union of personal + per-repo destinations when scopes = [personal, project]', () => {
    const skill: Skill = { urn: 'urn:skill:multi', kind: 'skill', name: 'multi', description: 'd',
      scopes: ['personal', 'project'], metadata: meta, source: WORKSPACE_SOURCE, content: 'b' };
    const linkedRepos: LinkedRepo[] = [
      { id: 'r1', name: 'app', path: '/repos/app' },
      { id: 'r2', name: 'lib', path: '/repos/lib' },
    ];
    expect(adapter.resolveEntityDestinations({ entity: skill, linkedRepos })).toEqual([
      { scope: 'personal', destination: '/home/u/.claude/skills/multi', strategy: 'symlink' },
      { scope: 'project', destination: '/repos/app/.claude/skills/multi', strategy: 'symlink' },
      { scope: 'project', destination: '/repos/lib/.claude/skills/multi', strategy: 'symlink' },
    ]);
  });

  it('routes a project-scoped agent to each linked repo', () => {
    const agent: Agent = { urn: 'urn:agent:triage', kind: 'agent', name: 'triage', description: 'd',
      scopes: ['project'], metadata: meta, source: WORKSPACE_SOURCE, systemPrompt: 'b' };
    const linkedRepos: LinkedRepo[] = [{ id: 'r', name: 'app', path: '/repos/app' }];
    expect(adapter.resolveEntityDestinations({ entity: agent, linkedRepos })).toEqual([
      { scope: 'project', destination: '/repos/app/.claude/agents/triage.md', strategy: 'symlink' },
    ]);
  });

  it('preserves spaces and accents in homedir and repo paths', () => {
    const accented = new ClaudeAdapter({ homedir: '/Users/José Silva' });
    const skill: Skill = { urn: 'urn:skill:review', kind: 'skill', name: 'review', description: 'd',
      scopes: ['personal'], metadata: meta, source: WORKSPACE_SOURCE, content: 'b' };
    const [personal] = accented.resolveEntityDestinations({ entity: skill, linkedRepos: [] });
    expect(personal?.destination).toBe('/Users/José Silva/.claude/skills/review');
    expect(isAbsolute(personal!.destination)).toBe(true);

    const agent: Agent = { urn: 'urn:agent:triage', kind: 'agent', name: 'triage', description: 'd',
      scopes: ['project'], metadata: meta, source: WORKSPACE_SOURCE, systemPrompt: 'b' };
    const repos: LinkedRepo[] = [{ id: 'r', name: 'r', path: '/Users/x/My Repo (work)' }];
    const [project] = accented.resolveEntityDestinations({ entity: agent, linkedRepos: repos });
    expect(project?.destination).toBe('/Users/x/My Repo (work)/.claude/agents/triage.md');
  });
});
