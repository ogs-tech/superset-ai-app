export interface GitHubApiPort {
  createRepo(input: {
    name: string;
    visibility: 'public' | 'private';
    description?: string;
  }): Promise<{ cloneUrl: string; htmlUrl: string; owner: string }>;
  repoExists(input: { owner: string; name: string }): Promise<boolean>;
  tagExists(input: { owner: string; name: string; tag: string }): Promise<boolean>;
  whoami(): Promise<{ login: string }>;
}
