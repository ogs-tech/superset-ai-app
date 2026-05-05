import { Octokit } from '@octokit/rest';
import type { GitHubApiPort } from '../../application/ports/github-api-port.js';
import { PublishAuthMissingError } from '../../domain/plugin-errors.js';

export class OctokitClient implements GitHubApiPort {
  // Lazy PAT factory — called fresh for each operation
  constructor(private readonly getToken: () => Promise<string | null>) {}

  private async getOctokit(): Promise<Octokit> {
    const token = await this.getToken();
    if (!token) throw new PublishAuthMissingError('GitHub PAT not configured');
    return new Octokit({ auth: token });
  }

  async createRepo(input: {
    name: string;
    visibility: 'public' | 'private';
    description?: string;
  }): Promise<{ cloneUrl: string; htmlUrl: string; owner: string }> {
    const octokit = await this.getOctokit();
    const resp = await octokit.repos.createForAuthenticatedUser({
      name: input.name,
      private: input.visibility === 'private',
      ...(input.description !== undefined && { description: input.description }),
    });
    return {
      cloneUrl: resp.data.clone_url,
      htmlUrl: resp.data.html_url,
      owner: resp.data.owner.login,
    };
  }

  async repoExists(input: { owner: string; name: string }): Promise<boolean> {
    const octokit = await this.getOctokit();
    try {
      await octokit.repos.get({ owner: input.owner, repo: input.name });
      return true;
    } catch (err: unknown) {
      if (isNotFoundError(err)) return false;
      throw err;
    }
  }

  async tagExists(input: { owner: string; name: string; tag: string }): Promise<boolean> {
    const octokit = await this.getOctokit();
    try {
      await octokit.git.getRef({
        owner: input.owner,
        repo: input.name,
        ref: `tags/${input.tag}`,
      });
      return true;
    } catch (err: unknown) {
      if (isNotFoundError(err)) return false;
      throw err;
    }
  }

  async whoami(): Promise<{ login: string }> {
    const octokit = await this.getOctokit();
    const resp = await octokit.users.getAuthenticated();
    return { login: resp.data.login };
  }
}

function isNotFoundError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    (err as { status: number }).status === 404
  );
}
