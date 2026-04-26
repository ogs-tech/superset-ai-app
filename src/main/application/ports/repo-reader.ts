export interface RepoReader {
  exists(path: string): Promise<boolean>;
  readFile(path: string): Promise<string>;
}
