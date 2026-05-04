import { promises as fs } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { basename, dirname, join } from 'node:path';

const hasErrnoCode = (err: unknown, code: string): boolean =>
  typeof err === 'object' && err !== null && (err as { code?: unknown }).code === code;

interface WorkspacePointer {
  workspacePath: string;
}

export class FsWorkspacePointerRepository {
  constructor(private readonly filePath: string) {}

  async read(): Promise<string | null> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const data = JSON.parse(raw) as WorkspacePointer;
      return typeof data.workspacePath === 'string' && data.workspacePath.length > 0
        ? data.workspacePath
        : null;
    } catch (err) {
      if (hasErrnoCode(err, 'ENOENT')) return null;
      throw err;
    }
  }

  async save(workspacePath: string): Promise<void> {
    const dir = dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
    const name = basename(this.filePath);
    const tempPath = join(dir, `.${name}.${randomBytes(8).toString('hex')}.tmp`);
    await fs.writeFile(tempPath, JSON.stringify({ workspacePath }, null, 2), 'utf8');
    try {
      await fs.rename(tempPath, this.filePath);
    } catch (err) {
      await fs.unlink(tempPath).catch(() => undefined);
      throw err;
    }
  }
}
