import type { PluginRef } from '../../domain/plugin-ref.js';

export interface GitPort {
  // imported plugins
  clone(url: string, ref: PluginRef | undefined, dest: string): Promise<{ sha: string }>;
  cloneSubdir(url: string, subdir: string, ref: string | undefined, dest: string): Promise<{ sha: string }>;
  pull(dir: string): Promise<{ sha: string }>;
  currentSha(dir: string): Promise<string>;
  resolveRef(url: string, ref: PluginRef): Promise<string>;

  // owned plugins + publish
  init(dir: string): Promise<void>;
  add(dir: string, paths?: string[]): Promise<void>;
  commit(dir: string, message: string): Promise<{ sha: string }>;
  addRemote(dir: string, name: string, url: string): Promise<void>;
  setRemoteUrl(dir: string, name: string, url: string): Promise<void>;
  hasRemote(dir: string, name: string): Promise<boolean>;
  push(dir: string, remote: string, ref: string, opts?: { setUpstream?: boolean }): Promise<void>;
  tag(dir: string, name: string, opts?: { message?: string }): Promise<void>;
  fetch(dir: string, remote?: string): Promise<void>;
  hasUncommittedChanges(dir: string): Promise<boolean>;
  remoteSha(dir: string, remote: string, branch: string): Promise<string | null>;
}
