import type { AdapterManager } from './adapter-manager.js';
import type { WritableFileSystemPort } from '../ports/writable-filesystem-port.js';

/**
 * "Restore to initial state" (factory reset). Undoes only this app's footprint:
 * the symlinks it created under adapter targets (those pointing into the
 * workspace) and the workspace directory itself. It deliberately never deletes
 * the wider `~/.claude` tree or any project `.env.local`.
 */
export class WorkspaceTeardownService {
  constructor(
    private readonly adapterManager: Pick<AdapterManager, 'removeAllAdapterSymlinks'>,
    private readonly fs: Pick<WritableFileSystemPort, 'remove'>,
    private readonly workspacePath: string,
  ) {}

  async restore(): Promise<void> {
    // Order matters: symlink discovery reads the workspace (customization list),
    // so the links must be removed before the workspace directory is deleted.
    await this.adapterManager.removeAllAdapterSymlinks();
    await this.fs.remove(this.workspacePath);
  }
}
