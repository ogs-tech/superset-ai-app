import type { FileSystemMutator } from '../ports/file-system-mutator.js';
import { WorkspacePaths } from '../../../shared/settings.js';

const joinPosix = (...parts: string[]): string => parts.join('/').replace(/\/+/g, '/');

export class WorkspaceBootstrapService {
  constructor(private readonly mutator: FileSystemMutator) {}

  async create(workspacePath: string): Promise<void> {
    for (const sub of WorkspacePaths) {
      await this.mutator.mkdirRecursive(joinPosix(workspacePath, sub));
    }
  }
}
