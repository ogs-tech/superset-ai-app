import type { FileSystemPort } from './filesystem-port.js';

export interface FileStat {
  mode: number;
}

export interface WritableFileSystemPort extends FileSystemPort {
  writeFile(path: string, content: string): Promise<void>;
  rename(oldPath: string, newPath: string): Promise<void>;
  chmod(path: string, mode: number): Promise<void>;
  stat(path: string): Promise<FileStat | null>;
}
