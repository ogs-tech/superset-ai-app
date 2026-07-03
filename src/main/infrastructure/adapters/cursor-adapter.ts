import { join } from 'node:path';
import type { Adapter, AdapterDestination } from '../../application/ports/adapter.js';
import type { LinkedRepo } from '../../../shared/settings.js';
import type { Entity, Instruction } from '../../../shared/entity.js';
import { DomainError } from '../../domain/errors.js';
import { renderAgentsFile } from '../../application/entity/agents-file.js';

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
 * `instruction` is materialized as a generated `AGENTS.md` file (`strategy: 'write'`)
 * in each linked repo; with no linked repos, it resolves to `[]`.
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

    if (kind === 'instruction') {
      // Cursor has no home-level instruction file; the global instruction (scope
      // personal) is materialized as <repo>/AGENTS.md in every linked repo.
      const content = renderAgentsFile(args.entity as Instruction);
      return args.linkedRepos.map((repo) => ({
        scope: 'project' as const,
        destination: join(repo.path, 'AGENTS.md'),
        strategy: 'write' as const,
        content,
      }));
    }

    if (kind !== 'skill' && kind !== 'agent') {
      return [];
    }

    const subfolder = kind === 'skill' ? '.cursor/skills' : '.cursor/agents';
    const fileName = kind === 'skill' ? name : `${name}.md`;
    const out: AdapterDestination[] = [];

    if (scopes.includes('personal')) {
      out.push({ scope: 'personal', destination: join(this.homedir, subfolder, fileName), strategy: 'symlink' });
    }
    if (scopes.includes('project')) {
      for (const repo of args.linkedRepos) {
        out.push({ scope: 'project', destination: join(repo.path, subfolder, fileName), strategy: 'symlink' });
      }
    }
    return out;
  }
}
