export interface FileSystemMutator {
  mkdirRecursive(path: string): Promise<void>;
}
