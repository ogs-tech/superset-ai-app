import fs from 'node:fs/promises';
import path from 'node:path';
import simpleGit from 'simple-git';
import type { GitPort } from '../../application/ports/git-port.js';
import type { PluginRef } from '../../domain/plugin-ref.js';
import { RefNotFoundError } from '../../domain/plugin-errors.js';

function sanitizeUrl(url: string): string {
  return url.replace(/https?:\/\/[^@]+@/, 'https://***@');
}

export class SimpleGitClient implements GitPort {
  // Fail early if git not in PATH
  static async checkGitAvailable(): Promise<void> {
    try {
      await simpleGit().version();
    } catch {
      throw new Error('git CLI not found in PATH');
    }
  }

  async clone(url: string, ref: PluginRef | undefined, dest: string): Promise<{ sha: string }> {
    if (!ref) {
      await simpleGit().clone(url, dest);
    } else if (ref.kind === 'sha') {
      // `git clone --branch` only accepts branch/tag names; a commit SHA fails
      // with "Remote branch <sha> not found". Fetch the exact commit instead.
      await this.cloneAtSha(url, ref.value, dest);
    } else {
      await simpleGit().clone(url, dest, ['--branch', ref.value, '--depth', '1']);
    }
    const sha = await this.currentSha(dest);
    return { sha };
  }

  async cloneSubdir(url: string, subdir: string, ref: string | undefined, dest: string): Promise<{ sha: string }> {
    const tmpRepoDir = `${dest}__repo`;
    try {
      if (!ref) {
        await simpleGit().clone(url, tmpRepoDir, ['--depth', '1']);
      } else {
        try {
          await simpleGit().clone(url, tmpRepoDir, ['--branch', ref, '--depth', '1']);
        } catch {
          // `ref` may be a commit SHA, which `--branch` rejects. Retry by
          // fetching the exact commit (this method takes a bare string, so we
          // can't tell branch from SHA up front).
          await fs.rm(tmpRepoDir, { recursive: true, force: true }).catch(() => {});
          await this.cloneAtSha(url, ref, tmpRepoDir);
        }
      }
      const sha = await this.currentSha(tmpRepoDir);
      await fs.rename(path.join(tmpRepoDir, subdir), dest);
      return { sha };
    } finally {
      await fs.rm(tmpRepoDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  /**
   * Clone a repository checked out at a specific commit SHA.
   *
   * `git clone --branch` only resolves branch and tag names, so pinning to a
   * commit requires the init + fetch-by-commit dance. GitHub permits fetching an
   * arbitrary reachable SHA (`uploadpack.allowAnySHA1InWant`); for servers that
   * disallow it we fall back to a full fetch before checking out.
   */
  private async cloneAtSha(url: string, sha: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    const git = simpleGit(dest);
    await git.init();
    await git.addRemote('origin', url);
    try {
      await git.fetch(['--depth', '1', 'origin', sha]);
    } catch {
      await git.fetch(['origin']);
    }
    await git.checkout(sha);
  }

  async pull(dir: string): Promise<{ sha: string }> {
    await simpleGit(dir).pull();
    const sha = await this.currentSha(dir);
    return { sha };
  }

  async currentSha(dir: string): Promise<string> {
    const result = await simpleGit(dir).revparse(['HEAD']);
    return result.trim();
  }

  async resolveRef(url: string, ref: PluginRef): Promise<string> {
    // Use ls-remote to get the SHA for a ref without cloning
    const git = simpleGit();
    const result = await git.listRemote(['--refs', url, ref.value]);
    const lines = result.trim().split('\n');
    const first = lines[0];
    if (lines.length === 0 || !first) {
      throw new RefNotFoundError(`Ref not found: ${ref.value} at ${sanitizeUrl(url)}`);
    }
    const sha = first.split('\t')[0];
    return (sha ?? first).trim();
  }

  async init(dir: string): Promise<void> {
    // Idempotent: skip if already a git repo
    try {
      await simpleGit(dir).status();
      return; // already initialized
    } catch {
      await simpleGit(dir).init();
    }
  }

  async add(dir: string, paths?: string[]): Promise<void> {
    await simpleGit(dir).add(paths ?? ['.']);
  }

  async commit(dir: string, message: string): Promise<{ sha: string }> {
    await simpleGit(dir).commit(message);
    return { sha: await this.currentSha(dir) };
  }

  async addRemote(dir: string, name: string, url: string): Promise<void> {
    // If remote already exists with same URL, skip. If different URL, remove+add.
    const git = simpleGit(dir);
    const remotes = await git.getRemotes(true);
    const existing = remotes.find((r) => r.name === name);
    if (existing) {
      if (existing.refs.push === url || existing.refs.fetch === url) return;
      await git.removeRemote(name);
    }
    await git.addRemote(name, url);
  }

  async hasRemote(dir: string, name: string): Promise<boolean> {
    const remotes = await simpleGit(dir).getRemotes();
    return remotes.some((r) => r.name === name);
  }

  async push(dir: string, remote: string, ref: string, opts?: { setUpstream?: boolean }): Promise<void> {
    const args = opts?.setUpstream ? ['-u'] : [];
    await simpleGit(dir).push(remote, ref, args);
  }

  async tag(dir: string, name: string, opts?: { message?: string }): Promise<void> {
    if (opts?.message) {
      await simpleGit(dir).tag(['-a', name, '-m', opts.message]);
    } else {
      await simpleGit(dir).tag([name]);
    }
  }

  async fetch(dir: string, remote?: string): Promise<void> {
    if (remote) {
      await simpleGit(dir).fetch(remote);
    } else {
      await simpleGit(dir).fetch();
    }
  }

  async hasUncommittedChanges(dir: string): Promise<boolean> {
    const status = await simpleGit(dir).status();
    return !status.isClean();
  }

  async remoteSha(dir: string, remote: string, branch: string): Promise<string | null> {
    try {
      const result = await simpleGit(dir).listRemote(['--heads', remote, branch]);
      const lines = result.trim().split('\n').filter(Boolean);
      if (lines.length === 0) return null;
      const first = lines[0];
      if (!first) return null;
      const sha = first.split('\t')[0];
      return (sha ?? first).trim();
    } catch {
      return null;
    }
  }
}
