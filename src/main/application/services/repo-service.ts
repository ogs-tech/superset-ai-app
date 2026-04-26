import type { RepoReader } from '../ports/repo-reader.js';

const REF_PREFIX = 'ref: refs/heads/';

const joinPosix = (...parts: string[]): string =>
  parts.join('/').replace(/\/+/g, '/');

export class RepoService {
  constructor(private readonly reader: RepoReader) {}

  detectGit(path: string): Promise<boolean> {
    return this.reader.exists(joinPosix(path, '.git'));
  }

  async getCurrentBranch(path: string): Promise<string | null> {
    const headPath = joinPosix(path, '.git/HEAD');
    if (!(await this.reader.exists(headPath))) return null;

    let content: string;
    try {
      content = await this.reader.readFile(headPath);
    } catch {
      return null;
    }

    const firstLine = content.split('\n', 1)[0]?.trim() ?? '';
    if (!firstLine.startsWith(REF_PREFIX)) return null;

    const branch = firstLine.slice(REF_PREFIX.length).trim();
    if (branch.length === 0) return null;

    const looseRefPath = joinPosix(path, '.git/refs/heads', branch);
    if (!(await this.reader.exists(looseRefPath))) return null;

    return branch;
  }
}
