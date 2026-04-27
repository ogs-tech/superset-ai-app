import type { Adapter, AdapterDestination } from '../../ports/adapter.js';
import type { Artifact } from '../../../../shared/artifact.js';
import type { LinkedRepo } from '../../../../shared/settings.js';

export class FakeAdapter implements Adapter {
  constructor(
    public readonly adapterId: string,
    private readonly personalDestination: string,
    private readonly projectDestinationTemplate: (repoPath: string) => string = (repoPath) => `${repoPath}/.fake-adapter`,
  ) {}

  resolveDestinations(args: {
    artifact: Artifact;
    linkedRepos: LinkedRepo[];
  }): AdapterDestination[] {
    if (args.artifact.frontmatter.scope === 'personal') {
      return [{ scope: 'personal', destination: this.personalDestination }];
    }

    return args.linkedRepos.map((repo) => ({
      scope: 'project',
      destination: this.projectDestinationTemplate(repo.path),
    }));
  }
}
