import { join } from 'node:path';
import type { Adapter, AdapterDestination } from '../../application/ports/adapter.js';
import type { CopilotInstructionsGenPort } from '../../application/ports/copilot-instructions-gen.js';
import type { SettingsService } from '../../application/services/settings-service.js';
import type { Artifact } from '../../../shared/artifact.js';
import type { LinkedRepo } from '../../../shared/settings.js';
import { DomainError } from '../../domain/errors.js';

export interface CopilotAdapterDeps {
  homedir: string;
  workspacePath: string;
  copilotInstructionsGen: CopilotInstructionsGenPort;
  settingsService?: SettingsService;
}

const PERSONAL_SUBFOLDER: Record<'skill' | 'agent', string> = {
  skill: '.copilot/skills',
  agent: '.copilot/agents',
};

const PROJECT_SUBFOLDER: Record<'skill' | 'agent', string> = {
  skill: '.github/skills',
  agent: '.github/agents',
};

export class CopilotAdapter implements Adapter {
  readonly adapterId = 'copilot';
  private readonly homedir: string;
  private readonly workspacePath: string;
  private readonly copilotInstructionsGen: CopilotInstructionsGenPort;
  private readonly settingsService: SettingsService | undefined;

  constructor(deps: CopilotAdapterDeps) {
    if (deps.homedir === undefined || deps.homedir === null || deps.homedir === '') {
      throw new DomainError(
        'internal',
        'CopilotAdapter requires a non-empty homedir',
        { reason: 'missing-homedir' },
      );
    }
    this.homedir = deps.homedir;
    this.workspacePath = deps.workspacePath;
    this.copilotInstructionsGen = deps.copilotInstructionsGen;
    this.settingsService = deps.settingsService;
  }

  async resolveDestinations(args: {
    artifact: Artifact;
    linkedRepos: LinkedRepo[];
  }): Promise<AdapterDestination[]> {
    const { type, scopes, name } = args.artifact.frontmatter;

    if (type === 'global-instruction' && name === 'copilot') {
      return [
        {
          scope: 'personal',
          destination: join(this.homedir, '.copilot/instructions/global.instructions.md'),
        },
      ];
    }

    if (type === 'reference') {
      const result = await this.copilotInstructionsGen.generate();
      if (result.refsIncluded === 0) return [];

      const out: AdapterDestination[] = [];
      if (scopes.includes('personal')) {
        out.push({
          scope: 'personal',
          destination: join(this.homedir, '.copilot/instructions/copilot-instructions.md'),
        });
      }
      if (scopes.includes('project')) {
        for (const repo of args.linkedRepos) {
          out.push({
            scope: 'project',
            destination: join(repo.path, '.github/copilot-instructions.md'),
          });
        }
      }
      return out;
    }

    if (type !== 'skill' && type !== 'agent') {
      return [];
    }

    if (type === 'skill' && this.settingsService) {
      const settings = await this.settingsService.load();
      if (settings?.adapters.copilot.exclusiveSkillsWithClaude && settings.adapters.claude.enabled) {
        return [];
      }
    }

    const fileName = type === 'skill' ? name : `${name}.agent.md`;
    const out: AdapterDestination[] = [];

    if (scopes.includes('personal')) {
      out.push({
        scope: 'personal',
        destination: join(this.homedir, PERSONAL_SUBFOLDER[type], fileName),
      });
    }

    if (scopes.includes('project')) {
      for (const repo of args.linkedRepos) {
        out.push({
          scope: 'project',
          destination: join(repo.path, PROJECT_SUBFOLDER[type], fileName),
        });
      }
    }

    return out;
  }
}
