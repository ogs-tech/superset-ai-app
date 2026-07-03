import { describe, it, expect } from 'vitest';
import { CursorAdapter } from '../../../../../src/main/infrastructure/adapters/cursor-adapter.js';
import {
  WORKSPACE_SOURCE,
  type Agent,
  type Instruction,
  type Skill,
} from '../../../../../src/shared/entity.js';
import type { LinkedRepo } from '../../../../../src/shared/settings.js';

const meta = { version: '0.1.0', createdAt: '', updatedAt: '' };
const adapter = new CursorAdapter({ homedir: '/home/u' });

describe('CursorAdapter.resolveEntityDestinations', () => {
  it('routes a personal skill to ~/.cursor/skills/<name> (directory)', () => {
    const skill: Skill = { urn: 'urn:skill:demo', kind: 'skill', name: 'demo', description: 'd',
      scopes: ['personal'], metadata: meta, source: WORKSPACE_SOURCE, content: 'b' };
    expect(adapter.resolveEntityDestinations({ entity: skill, linkedRepos: [] })).toEqual([
      { scope: 'personal', destination: '/home/u/.cursor/skills/demo' },
    ]);
  });

  it('routes an explicit-only skill (slash-command) to the same skills directory', () => {
    const command: Skill = { urn: 'urn:skill:deploy', kind: 'skill', name: 'deploy', description: 'd',
      scopes: ['personal'], metadata: meta, source: WORKSPACE_SOURCE, content: 'b', explicitOnly: true };
    expect(adapter.resolveEntityDestinations({ entity: command, linkedRepos: [] })).toEqual([
      { scope: 'personal', destination: '/home/u/.cursor/skills/deploy' },
    ]);
  });

  it('fans a [personal, project] skill out to ~/.cursor and each linked repo', () => {
    const skill: Skill = { urn: 'urn:skill:multi', kind: 'skill', name: 'multi', description: 'd',
      scopes: ['personal', 'project'], metadata: meta, source: WORKSPACE_SOURCE, content: 'b' };
    const linkedRepos: LinkedRepo[] = [
      { id: 'r1', name: 'app', path: '/repos/app' },
      { id: 'r2', name: 'lib', path: '/repos/lib' },
    ];
    expect(adapter.resolveEntityDestinations({ entity: skill, linkedRepos })).toEqual([
      { scope: 'personal', destination: '/home/u/.cursor/skills/multi' },
      { scope: 'project', destination: '/repos/app/.cursor/skills/multi' },
      { scope: 'project', destination: '/repos/lib/.cursor/skills/multi' },
    ]);
  });

  it('routes a project-scoped agent to <repo>/.cursor/agents/<name>.md', () => {
    const agent: Agent = { urn: 'urn:agent:triage', kind: 'agent', name: 'triage', description: 'd',
      scopes: ['project'], metadata: meta, source: WORKSPACE_SOURCE, systemPrompt: 'b' };
    const linkedRepos: LinkedRepo[] = [{ id: 'r', name: 'app', path: '/repos/app' }];
    expect(adapter.resolveEntityDestinations({ entity: agent, linkedRepos })).toEqual([
      { scope: 'project', destination: '/repos/app/.cursor/agents/triage.md' },
    ]);
  });

  it('returns [] for an instruction (deferred to Plan B — AGENTS.md write)', () => {
    const ins: Instruction = { urn: 'urn:instruction:default', kind: 'instruction', name: 'default',
      description: '', scopes: ['personal'], metadata: meta, source: WORKSPACE_SOURCE, content: 'b', activation: 'always' };
    expect(adapter.resolveEntityDestinations({ entity: ins, linkedRepos: [] })).toEqual([]);
  });
});
