import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import simpleGit from 'simple-git';
import { SimpleGitClient } from '../../../../src/main/infrastructure/git/simple-git-client.js';

async function makeTmpDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'sde-git-test-'));
}

async function configureGitUser(dir: string): Promise<void> {
  const git = simpleGit(dir);
  await git.addConfig('user.email', 'test@test.com');
  await git.addConfig('user.name', 'Test');
}

describe('SimpleGitClient', () => {
  let client: SimpleGitClient;
  let tmpDirs: string[];

  beforeEach(() => {
    client = new SimpleGitClient();
    tmpDirs = [];
  });

  afterEach(async () => {
    await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
  });

  async function createTmp(): Promise<string> {
    const dir = await makeTmpDir();
    tmpDirs.push(dir);
    return dir;
  }

  describe('init + add + commit + currentSha', () => {
    it('returns a 40-char hex SHA after first commit', async () => {
      const dir = await createTmp();
      await client.init(dir);
      await configureGitUser(dir);

      await writeFile(path.join(dir, 'hello.txt'), 'hello world');
      await client.add(dir);
      const { sha } = await client.commit(dir, 'initial commit');

      expect(sha).toMatch(/^[a-f0-9]{40}$/);

      const currentSha = await client.currentSha(dir);
      expect(currentSha).toBe(sha);
    });

    it('init is idempotent — calling twice does not throw', async () => {
      const dir = await createTmp();
      await client.init(dir);
      await expect(client.init(dir)).resolves.toBeUndefined();
    });
  });

  describe('hasUncommittedChanges', () => {
    it('returns true after add but before commit', async () => {
      const dir = await createTmp();
      await client.init(dir);
      await configureGitUser(dir);

      await writeFile(path.join(dir, 'file.txt'), 'content');
      await client.add(dir);

      await expect(client.hasUncommittedChanges(dir)).resolves.toBe(true);
    });

    it('returns false after commit', async () => {
      const dir = await createTmp();
      await client.init(dir);
      await configureGitUser(dir);

      await writeFile(path.join(dir, 'file.txt'), 'content');
      await client.add(dir);
      await client.commit(dir, 'commit');

      await expect(client.hasUncommittedChanges(dir)).resolves.toBe(false);
    });
  });

  describe('tag', () => {
    it('creates a lightweight tag after commit', async () => {
      const dir = await createTmp();
      await client.init(dir);
      await configureGitUser(dir);

      await writeFile(path.join(dir, 'file.txt'), 'content');
      await client.add(dir);
      await client.commit(dir, 'tagged commit');

      await client.tag(dir, 'v1.0.0');

      const tags = await simpleGit(dir).tags();
      expect(tags.all).toContain('v1.0.0');
    });

    it('creates an annotated tag with message', async () => {
      const dir = await createTmp();
      await client.init(dir);
      await configureGitUser(dir);

      await writeFile(path.join(dir, 'file.txt'), 'content');
      await client.add(dir);
      await client.commit(dir, 'tagged commit');

      await client.tag(dir, 'v2.0.0', { message: 'release v2.0.0' });

      const tags = await simpleGit(dir).tags();
      expect(tags.all).toContain('v2.0.0');
    });
  });

  describe('push to bare remote', () => {
    it('pushes commits to a local bare repo', async () => {
      const dir = await createTmp();
      const bareDir = await createTmp();

      // Init bare repo as "remote"
      await simpleGit(bareDir).init(true);

      // Init working repo, commit, add remote, push
      await client.init(dir);
      await configureGitUser(dir);

      await writeFile(path.join(dir, 'file.txt'), 'content');
      await client.add(dir);
      await client.commit(dir, 'first commit');

      await client.addRemote(dir, 'origin', bareDir);
      await client.push(dir, 'origin', 'main');

      // Verify: the bare repo should have the ref
      const result = await simpleGit(bareDir).branch(['-a']);
      expect(result.all.some((b) => b.includes('main'))).toBe(true);
    });
  });

  describe('remoteSha', () => {
    it('returns the commit SHA after push', async () => {
      const dir = await createTmp();
      const bareDir = await createTmp();

      await simpleGit(bareDir).init(true);

      await client.init(dir);
      await configureGitUser(dir);

      await writeFile(path.join(dir, 'file.txt'), 'content');
      await client.add(dir);
      const { sha: commitSha } = await client.commit(dir, 'first commit');

      await client.addRemote(dir, 'origin', bareDir);
      await client.push(dir, 'origin', 'main');

      const remoteSha = await client.remoteSha(dir, 'origin', 'main');
      expect(remoteSha).toBe(commitSha);
    });

    it('returns null for a branch that does not exist on remote', async () => {
      const dir = await createTmp();
      const bareDir = await createTmp();

      await simpleGit(bareDir).init(true);

      await client.init(dir);
      await configureGitUser(dir);

      await writeFile(path.join(dir, 'file.txt'), 'content');
      await client.add(dir);
      await client.commit(dir, 'first commit');

      await client.addRemote(dir, 'origin', bareDir);
      // Do NOT push

      const remoteSha = await client.remoteSha(dir, 'origin', 'nonexistent-branch');
      expect(remoteSha).toBeNull();
    });
  });

  describe('hasRemote', () => {
    it('returns false before addRemote', async () => {
      const dir = await createTmp();
      await client.init(dir);

      await expect(client.hasRemote(dir, 'origin')).resolves.toBe(false);
    });

    it('returns true after addRemote', async () => {
      const dir = await createTmp();
      const bareDir = await createTmp();

      await simpleGit(bareDir).init(true);

      await client.init(dir);
      await client.addRemote(dir, 'origin', bareDir);

      await expect(client.hasRemote(dir, 'origin')).resolves.toBe(true);
    });

    it('addRemote is idempotent when URL is the same', async () => {
      const dir = await createTmp();
      const bareDir = await createTmp();

      await simpleGit(bareDir).init(true);

      await client.init(dir);
      await client.addRemote(dir, 'origin', bareDir);
      await expect(client.addRemote(dir, 'origin', bareDir)).resolves.toBeUndefined();

      const remotes = await simpleGit(dir).getRemotes(true);
      expect(remotes.filter((r) => r.name === 'origin')).toHaveLength(1);
    });

    it('addRemote replaces remote when URL changes', async () => {
      const dir = await createTmp();
      const bareDir1 = await createTmp();
      const bareDir2 = await createTmp();

      await simpleGit(bareDir1).init(true);
      await simpleGit(bareDir2).init(true);

      await client.init(dir);
      await client.addRemote(dir, 'origin', bareDir1);
      await client.addRemote(dir, 'origin', bareDir2);

      const remotes = await simpleGit(dir).getRemotes(true);
      const origin = remotes.find((r) => r.name === 'origin');
      expect(origin?.refs.push).toBe(bareDir2);
    });
  });
});
