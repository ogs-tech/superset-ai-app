import type { GitPort } from '../../ports/git-port.js';
import type { PluginRef } from '../../../domain/plugin-ref.js';

export class FakeGitPort implements GitPort {
  private clones: Map<string, { sha: string }> = new Map();
  private shas: Map<string, string> = new Map();
  private remotes: Map<string, Map<string, string>> = new Map();
  private commits: Map<string, string[]> = new Map();
  private tags: Map<string, string[]> = new Map();
  private uncommittedChanges: Map<string, boolean> = new Map();
  private remoteShas: Map<string, string | null> = new Map();
  private nextFailure: Error | null = null;

  seedSha(url: string, ref: string | undefined, sha: string): void {
    this.shas.set(`${url}@${ref ?? ''}`, sha);
  }

  failNext(error: Error): void {
    this.nextFailure = error;
  }

  setUncommittedChanges(dir: string, value: boolean): void {
    this.uncommittedChanges.set(dir, value);
  }

  setRemoteSha(dir: string, remote: string, branch: string, sha: string | null): void {
    this.remoteShas.set(`${dir}/${remote}/${branch}`, sha);
  }

  private maybeThrow(): void {
    if (this.nextFailure !== null) {
      const err = this.nextFailure;
      this.nextFailure = null;
      throw err;
    }
  }

  async clone(url: string, ref: PluginRef | undefined, dest: string): Promise<{ sha: string }> {
    this.maybeThrow();
    const key = `${url}@${ref?.value ?? ''}`;
    const sha = this.shas.get(key) ?? `fake-sha-${Date.now()}`;
    this.clones.set(dest, { sha });
    return { sha };
  }

  async cloneSubdir(
    url: string,
    _subdir: string,
    ref: string | undefined,
    dest: string,
  ): Promise<{ sha: string }> {
    this.maybeThrow();
    const key = `${url}@${ref ?? ''}`;
    const sha = this.shas.get(key) ?? `fake-sha-${Date.now()}`;
    this.clones.set(dest, { sha });
    return { sha };
  }

  async pull(dir: string): Promise<{ sha: string }> {
    this.maybeThrow();
    const existing = this.clones.get(dir);
    const sha = existing?.sha ?? `fake-sha-${Date.now()}`;
    this.clones.set(dir, { sha });
    return { sha };
  }

  async currentSha(dir: string): Promise<string> {
    this.maybeThrow();
    return this.clones.get(dir)?.sha ?? `fake-sha-${Date.now()}`;
  }

  async resolveRef(url: string, ref: PluginRef): Promise<string> {
    this.maybeThrow();
    const key = `${url}@${ref.value}`;
    return this.shas.get(key) ?? `fake-sha-${Date.now()}`;
  }

  async init(dir: string): Promise<void> {
    this.maybeThrow();
    if (!this.remotes.has(dir)) {
      this.remotes.set(dir, new Map());
    }
  }

  async add(_dir: string, _paths?: string[]): Promise<void> {
    this.maybeThrow();
  }

  async commit(dir: string, _message: string): Promise<{ sha: string }> {
    this.maybeThrow();
    const sha = `fake-sha-${Date.now()}`;
    const existing = this.commits.get(dir) ?? [];
    this.commits.set(dir, [...existing, sha]);
    return { sha };
  }

  async addRemote(dir: string, name: string, url: string): Promise<void> {
    this.maybeThrow();
    const dirRemotes = this.remotes.get(dir) ?? new Map<string, string>();
    dirRemotes.set(name, url);
    this.remotes.set(dir, dirRemotes);
  }

  async hasRemote(dir: string, name: string): Promise<boolean> {
    this.maybeThrow();
    return this.remotes.get(dir)?.has(name) ?? false;
  }

  async push(
    _dir: string,
    _remote: string,
    _ref: string,
    _opts?: { setUpstream?: boolean },
  ): Promise<void> {
    this.maybeThrow();
  }

  async tag(dir: string, name: string, _opts?: { message?: string }): Promise<void> {
    this.maybeThrow();
    const existing = this.tags.get(dir) ?? [];
    this.tags.set(dir, [...existing, name]);
  }

  async fetch(_dir: string, _remote?: string): Promise<void> {
    this.maybeThrow();
  }

  async hasUncommittedChanges(dir: string): Promise<boolean> {
    this.maybeThrow();
    return this.uncommittedChanges.get(dir) ?? false;
  }

  async remoteSha(dir: string, remote: string, branch: string): Promise<string | null> {
    this.maybeThrow();
    const key = `${dir}/${remote}/${branch}`;
    return this.remoteShas.has(key) ? (this.remoteShas.get(key) ?? null) : null;
  }
}
