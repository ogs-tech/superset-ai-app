import { join } from 'node:path';
import type { Adapter, AdapterDestination } from '../../application/ports/adapter.js';
import type { LinkedRepo } from '../../../shared/settings.js';
import type { Entity } from '../../../shared/entity.js';
import { DomainError } from '../../domain/errors.js';

export interface CursorAdapterDeps {
  homedir: string;
}

/**
 * Publishes workspace entities into Cursor's native file surface via symlinks.
 * Skills (incl. slash-commands, which are explicit-only skills whose on-disk
 * SKILL.md already carries `disable-model-invocation: true`) are symlinked as
 * whole directories; agents as single `.md` files. Cursor ignores the extra
 * Claude-style frontmatter keys, reading only `name`/`description`.
 *
 * `instruction` has no home-level file in Cursor; its per-repo AGENTS.md is a
 * generated-file (`write`) case handled by Plan B, so it resolves to [] here.
 */
export class CursorAdapter implements Adapter {
  readonly adapterId = 'cursor';
  private readonly homedir: string;

  constructor(deps: CursorAdapterDeps) {
    if (deps.homedir === undefined || deps.homedir === null || deps.homedir === '') {
      throw new DomainError('internal', 'CursorAdapter requires a non-empty homedir', {
        reason: 'missing-homedir',
      });
    }
    this.homedir = deps.homedir;
  }

  resolveEntityDestinations(args: {
    entity: Entity;
    linkedRepos: LinkedRepo[];
  }): AdapterDestination[] {
    const { kind, name, scopes } = args.entity;

    if (kind !== 'skill' && kind !== 'agent') {
      return [];
    }

    const subfolder = kind === 'skill' ? '.cursor/skills' : '.cursor/agents';
    const fileName = kind === 'skill' ? name : `${name}.md`;
    const out: AdapterDestination[] = [];

    if (scopes.includes('personal')) {
      out.push({ scope: 'personal', destination: join(this.homedir, subfolder, fileName) });
    }
    if (scopes.includes('project')) {
      for (const repo of args.linkedRepos) {
        out.push({ scope: 'project', destination: join(repo.path, subfolder, fileName) });
      }
    }
    return out;
  }
}
