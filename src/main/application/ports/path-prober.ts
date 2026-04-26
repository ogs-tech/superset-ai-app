export interface PathProber {
  exists(path: string): Promise<boolean>;
}
