import type { FileSystemPort } from './filesystem-port.js';

export interface FileStat {
  mode: number;
}

export interface WritableFileSystemPort extends FileSystemPort {
  writeFile(path: string, content: string): Promise<void>;
  rename(oldPath: string, newPath: string): Promise<void>;
  chmod(path: string, mode: number): Promise<void>;
  stat(path: string): Promise<FileStat | null>;
  /** Recursively remove a path; no-op if it does not exist (rm -rf semantics). */
  remove(path: string): Promise<void>;
  /** Create a fresh, unique temporary directory and return its absolute path. */
  makeTempDir(prefix: string): Promise<string>;
}
