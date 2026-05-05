export type FileSystemEntryKind = 'symlink' | 'file' | 'directory' | 'none';

export interface FileSystemEntry {
  kind: FileSystemEntryKind;
  target?: string;
}

export interface FileSystemPort {
  lstat(path: string): Promise<FileSystemEntry>;
  readlink(path: string): Promise<string>;
  symlink(args: { target: string; path: string }): Promise<void>;
  unlink(path: string): Promise<void>;
  mkdir(path: string, options: { recursive: boolean }): Promise<void>;
  copyFile(src: string, dest: string): Promise<void>;
  readdir(path: string): Promise<string[]>;
  pathExists(path: string): Promise<boolean>;
  readFile(path: string): Promise<string>;
}
