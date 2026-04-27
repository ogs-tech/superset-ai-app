import { dirname, normalize, relative } from 'node:path';
import type { FileSystemEntry, FileSystemPort } from '../../application/ports/filesystem-port.js';

type ErrorWithCode = Error & { code?: string };

interface FileSystemEntryRecord {
  kind: Exclude<FileSystemEntry['kind'], 'none'>;
  target?: string;
  content?: string;
}

interface FailOnRule {
  op: 'lstat' | 'readlink' | 'symlink' | 'unlink' | 'mkdir' | 'copyFile' | 'readdir' | 'pathExists';
  path: string;
  code: string;
}

export class InMemoryFileSystem implements FileSystemPort {
  private readonly entries = new Map<string, FileSystemEntryRecord>();
  private readonly failOn: FailOnRule[];

  constructor(failOn: FailOnRule[] = []) {
    this.failOn = failOn;
  }

  private normalize(path: string): string {
    return normalize(path);
  }

  private checkFail(op: FailOnRule['op'], path: string): void {
    const normalized = this.normalize(path);
    const rule = this.failOn.find((item) => item.op === op && this.normalize(item.path) === normalized);
    if (rule) {
      const err = new Error(`Mock failure ${op} ${normalized}`) as Error & { code?: string };
      err.code = rule.code;
      throw err;
    }
  }

  private ensureDirectory(path: string): void {
    const normalized = this.normalize(path);
    const parent = dirname(normalized);
    if (parent !== normalized) {
      this.ensureDirectory(parent);
    }
    if (!this.entries.has(normalized)) {
      this.entries.set(normalized, { kind: 'directory' });
    }
  }

  async lstat(path: string): Promise<FileSystemEntry> {
    this.checkFail('lstat', path);
    const normalized = this.normalize(path);
    const entry = this.entries.get(normalized);
    if (!entry) {
      return { kind: 'none' };
    }
    if (entry.kind === 'symlink') {
      if (entry.target !== undefined) {
        return { kind: 'symlink', target: entry.target };
      }
      return { kind: 'symlink' };
    }
    return { kind: entry.kind };
  }

  async readlink(path: string): Promise<string> {
    this.checkFail('readlink', path);
    const normalized = this.normalize(path);
    const entry = this.entries.get(normalized);
    if (!entry || entry.kind !== 'symlink' || entry.target === undefined) {
      const err = new Error('Invalid symlink path');
      throw err;
    }
    return entry.target;
  }

  async symlink(args: { target: string; path: string }): Promise<void> {
    this.checkFail('symlink', args.path);
    const normalized = this.normalize(args.path);
    this.ensureDirectory(dirname(normalized));
    this.entries.set(normalized, { kind: 'symlink', target: args.target });
  }

  async unlink(path: string): Promise<void> {
    this.checkFail('unlink', path);
    const normalized = this.normalize(path);
    if (!this.entries.has(normalized)) {
      const err: ErrorWithCode = new Error('ENOENT');
      err.code = 'ENOENT';
      throw err;
    }
    this.entries.delete(normalized);
  }

  async mkdir(path: string, options: { recursive: boolean }): Promise<void> {
    this.checkFail('mkdir', path);
    const normalized = this.normalize(path);
    if (options.recursive) {
      this.ensureDirectory(normalized);
      return;
    }
    if (this.entries.has(normalized)) {
      return;
    }
    this.entries.set(normalized, { kind: 'directory' });
  }

  async copyFile(src: string, dest: string): Promise<void> {
    this.checkFail('copyFile', dest);
    const srcPath = this.normalize(src);
    const destPath = this.normalize(dest);
    const entry = this.entries.get(srcPath);
    if (!entry || entry.kind !== 'file' || entry.content === undefined) {
      const err: ErrorWithCode = new Error('ENOENT');
      err.code = 'ENOENT';
      throw err;
    }
    this.ensureDirectory(dirname(destPath));
    this.entries.set(destPath, { kind: 'file', content: entry.content });
  }

  async readdir(path: string): Promise<string[]> {
    this.checkFail('readdir', path);
    const normalized = this.normalize(path);
    const entry = this.entries.get(normalized);
    if (!entry || entry.kind !== 'directory') {
      const err: ErrorWithCode = new Error('ENOTDIR');
      err.code = 'ENOTDIR';
      throw err;
    }
    const names = new Set<string>();
    for (const key of this.entries.keys()) {
      const relativePath = relative(normalized, key);
      if (!relativePath || relativePath.startsWith('..') || relativePath === '.') continue;
      const segments = relativePath.split(/[/\\]/);
      const firstSegment = segments[0] ?? '';
      if (firstSegment) {
        names.add(firstSegment);
      }
    }
    return Array.from(names);
  }

  async pathExists(path: string): Promise<boolean> {
    this.checkFail('pathExists', path);
    const normalized = this.normalize(path);
    if (this.entries.has(normalized)) return true;
    for (const key of this.entries.keys()) {
      if (key.startsWith(`${normalized}/`) || key.startsWith(`${normalized}\\`)) {
        return true;
      }
    }
    return false;
  }

  async readFile(path: string): Promise<string> {
    const normalized = this.normalize(path);
    const entry = this.entries.get(normalized);
    if (!entry || entry.kind !== 'file' || entry.content === undefined) {
      const err: ErrorWithCode = new Error('ENOENT');
      err.code = 'ENOENT';
      throw err;
    }
    return entry.content;
  }

  createFile(path: string, content: string): void {
    const normalized = this.normalize(path);
    this.ensureDirectory(dirname(normalized));
    this.entries.set(normalized, { kind: 'file', content });
  }
}
