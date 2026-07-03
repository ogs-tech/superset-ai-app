import { dirname, relative, resolve } from 'node:path';
import type { WritableFileSystemPort } from '../ports/writable-filesystem-port.js';
import type { ClockPort } from '../ports/clock-port.js';
import { GENERATED_FILE_MARKER } from '../entity/agents-file.js';
import { DomainError, ioError } from '../../domain/errors.js';

export type GeneratedFileState = 'ok' | 'missing' | 'drift' | 'foreign';

export interface FileMaterializeResult {
  status: 'ok' | 'conflict';
  details?: { backupPath?: string; action?: 'overwritten' };
}

/**
 * Write-side twin of SymlinkManager for app-generated files (e.g. <repo>/AGENTS.md).
 * Ownership is signalled by GENERATED_FILE_MARKER on the file's first line: the app
 * only overwrites/removes files it owns; a foreign file is backed up before overwrite
 * and never deleted. Backup scheme mirrors SymlinkManager: <workspace>/_backups/<ts>/<rel>.
 */
export class FileMaterializer {
  constructor(
    private readonly fs: WritableFileSystemPort,
    private readonly clock: ClockPort,
    private readonly workspacePath: string,
  ) {}

  async write(args: { destination: string; content: string }): Promise<FileMaterializeResult> {
    const dest = resolve(args.destination);
    try {
      await this.fs.mkdir(dirname(dest), { recursive: true });
      const stat = await this.fs.lstat(dest);
      if (stat.kind === 'none') {
        await this.fs.writeFile(dest, args.content);
        return { status: 'ok' };
      }
      const existing = await this.fs.readFile(dest);
      if (this.isOwned(existing)) {
        await this.fs.writeFile(dest, args.content);
        return { status: 'ok' };
      }
      const backupPath = await this.backup(dest, existing);
      await this.fs.writeFile(dest, args.content);
      return { status: 'conflict', details: { backupPath, action: 'overwritten' } };
    } catch (err) {
      if (err instanceof DomainError) throw err;
      if (err instanceof Error) {
        const details: { code?: string } = {};
        const code = (err as { code?: string }).code;
        if (code !== undefined) details.code = code;
        throw ioError({ message: err.message, details });
      }
      throw err;
    }
  }

  async removeIfOwned(args: { destination: string }): Promise<{ removed: boolean }> {
    const dest = resolve(args.destination);
    const stat = await this.fs.lstat(dest);
    if (stat.kind === 'none') return { removed: false };
    const existing = await this.fs.readFile(dest);
    if (!this.isOwned(existing)) return { removed: false };
    await this.fs.unlink(dest);
    return { removed: true };
  }

  async validate(args: { destination: string; content: string }): Promise<GeneratedFileState> {
    const dest = resolve(args.destination);
    const stat = await this.fs.lstat(dest);
    if (stat.kind === 'none') return 'missing';
    const existing = await this.fs.readFile(dest);
    if (!this.isOwned(existing)) return 'foreign';
    return existing === args.content ? 'ok' : 'drift';
  }

  private isOwned(content: string): boolean {
    return content.startsWith(GENERATED_FILE_MARKER);
  }

  private async backup(destinationPath: string, content: string): Promise<string> {
    let relativeTarget = relative(this.workspacePath, destinationPath);
    if (relativeTarget.startsWith('..')) {
      relativeTarget = destinationPath.replace(/^\/+/, '');
      if (relativeTarget === '') {
        throw ioError({
          message: `Cannot derive backup path for: ${destinationPath}`,
          details: { reason: 'backup-path-undeterminable' },
        });
      }
    }
    const backupPath = await this.nextBackupPath(relativeTarget, this.timestampForNow());
    await this.fs.mkdir(dirname(backupPath), { recursive: true });
    await this.fs.writeFile(backupPath, content);
    return backupPath;
  }

  private timestampForNow(): string {
    const now = this.clock.now();
    const pad = (v: number) => String(v).padStart(2, '0');
    return (
      `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
      `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`
    );
  }

  private async nextBackupPath(relativeTarget: string, timestamp: string): Promise<string> {
    let attempt = 0;
    while (true) {
      const suffix = attempt === 0 ? '' : `-${attempt}`;
      const backupPath = resolve(this.workspacePath, '_backups', `${timestamp}${suffix}`, relativeTarget);
      if (!(await this.fs.pathExists(backupPath))) return backupPath;
      attempt += 1;
    }
  }
}
