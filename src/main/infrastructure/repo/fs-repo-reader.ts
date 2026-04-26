import { promises as fs } from 'node:fs';
import type { RepoReader } from '../../application/ports/repo-reader.js';

export class FsRepoReader implements RepoReader {
  async exists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  readFile(path: string): Promise<string> {
    return fs.readFile(path, 'utf8');
  }
}
