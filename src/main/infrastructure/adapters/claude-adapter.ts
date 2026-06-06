import { join } from 'node:path';
import type { Adapter, AdapterDestination } from '../../application/ports/adapter.js';
import type { Customization } from '../../../shared/customization.js';
import type { LinkedRepo } from '../../../shared/settings.js';
import { DomainError } from '../../domain/errors.js';

export interface ClaudeAdapterDeps {
  homedir: string;
}

const SUBFOLDER_BY_TYPE: Record<'skill' | 'agent' | 'command', string> = {
  skill: '.claude/skills',
  agent: '.claude/agents',
  command: '.claude/commands',
};

export class ClaudeAdapter implements Adapter {
  readonly adapterId = 'claude';
  private readonly homedir: string;

  constructor(deps: ClaudeAdapterDeps) {
    if (deps.homedir === undefined || deps.homedir === null || deps.homedir === '') {
      throw new DomainError(
        'internal',
        'ClaudeAdapter requires a non-empty homedir',
        { reason: 'missing-homedir' },
      );
    }
    this.homedir = deps.homedir;
  }

  resolveDestinations(args: {
    customization: Customization;
    linkedRepos: LinkedRepo[];
  }): AdapterDestination[] {
    const { type, scopes, name } = args.customization.frontmatter;

    if (type === 'global-instruction') {
      return [
        {
          scope: 'personal',
          destination: join(this.homedir, '.claude/CLAUDE.md'),
        },
      ];
    }

    if (type !== 'skill' && type !== 'agent' && type !== 'command') {
      return [];
    }

    const subfolder = SUBFOLDER_BY_TYPE[type];
    // Skills are directories synced under their bare name; agents and commands
    // are single Markdown files.
    const fileName = type === 'skill' ? name : `${name}.md`;
    const out: AdapterDestination[] = [];

    if (scopes.includes('personal')) {
      out.push({
        scope: 'personal',
        destination: join(this.homedir, subfolder, fileName),
      });
    }

    if (scopes.includes('project')) {
      for (const repo of args.linkedRepos) {
        out.push({
          scope: 'project',
          destination: join(repo.path, subfolder, fileName),
        });
      }
    }

    return out;
  }
}
