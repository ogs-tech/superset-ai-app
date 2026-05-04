import type { GitHubApiPort } from '../../ports/github-api-port.js';

export class FakeGitHubApiPort implements GitHubApiPort {
  private repos: Set<string> = new Set();
  private tags: Map<string, Set<string>> = new Map();
  private owner: string = 'fake-owner';
  private nextFailure: Error | null = null;

  seedRepo(owner: string, name: string): void {
    this.repos.add(`${owner}/${name}`);
  }

  seedTag(owner: string, name: string, tag: string): void {
    const key = `${owner}/${name}`;
    const existing = this.tags.get(key) ?? new Set<string>();
    existing.add(tag);
    this.tags.set(key, existing);
  }

  setOwner(login: string): void {
    this.owner = login;
  }

  failNext(error: Error): void {
    this.nextFailure = error;
  }

  getCreatedRepos(): Set<string> {
    return this.repos;
  }

  private maybeThrow(): void {
    if (this.nextFailure !== null) {
      const err = this.nextFailure;
      this.nextFailure = null;
      throw err;
    }
  }

  async createRepo(input: {
    name: string;
    visibility: 'public' | 'private';
    description?: string;
  }): Promise<{ cloneUrl: string; htmlUrl: string; owner: string }> {
    this.maybeThrow();
    this.repos.add(`${this.owner}/${input.name}`);
    return {
      cloneUrl: `https://github.com/${this.owner}/${input.name}.git`,
      htmlUrl: `https://github.com/${this.owner}/${input.name}`,
      owner: this.owner,
    };
  }

  async repoExists(input: { owner: string; name: string }): Promise<boolean> {
    this.maybeThrow();
    return this.repos.has(`${input.owner}/${input.name}`);
  }

  async tagExists(input: { owner: string; name: string; tag: string }): Promise<boolean> {
    this.maybeThrow();
    return this.tags.get(`${input.owner}/${input.name}`)?.has(input.tag) ?? false;
  }

  async whoami(): Promise<{ login: string }> {
    this.maybeThrow();
    return { login: this.owner };
  }
}
