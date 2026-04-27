import { promises as fs } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { FileSystemEntry, FileSystemPort } from '../../application/ports/filesystem-port.js';

const toEntryKind = async (path: string): Promise<FileSystemEntry['kind']> => {
  const stat = await fs.lstat(path);
  if (stat.isSymbolicLink()) return 'symlink';
  if (stat.isDirectory()) return 'directory';
  if (stat.isFile()) return 'file';
  return 'file';
};

const resolveLinkTarget = (linkPath: string, target: string): string => {
  if (target.startsWith('/') || target.match(/^[A-Za-z]:\\/)) {
    return resolve(target);
  }
  return resolve(dirname(linkPath), target);
};

export class NodeFsAdapter implements FileSystemPort {
  async lstat(path: string): Promise<FileSystemEntry> {
    try {
      const kind = await toEntryKind(path);
      if (kind === 'symlink') {
        return { kind, target: await fs.readlink(path) };
      }
      return { kind };
    } catch (err) {
      if (err && typeof err === 'object' && (err as { code?: string }).code === 'ENOENT') {
        return { kind: 'none' };
      }
      throw err;
    }
  }

  async readlink(path: string): Promise<string> {
    const raw = await fs.readlink(path);
    return resolveLinkTarget(path, raw);
  }

  async symlink(args: { target: string; path: string }): Promise<void> {
    await fs.symlink(args.target, args.path);
  }

  async unlink(path: string): Promise<void> {
    await fs.unlink(path);
  }

  async mkdir(path: string, options: { recursive: boolean }): Promise<void> {
    await fs.mkdir(path, options);
  }

  async copyFile(src: string, dest: string): Promise<void> {
    await fs.copyFile(src, dest);
  }

  async readdir(path: string): Promise<string[]> {
    return fs.readdir(path);
  }

  async pathExists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }
}
