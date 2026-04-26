import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FsRepoReader } from '../../../src/main/infrastructure/repo/fs-repo-reader.js';

describe('FsRepoReader', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(join(tmpdir(), 'fs-repo-reader-'));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('exists returns true for an existing path', async () => {
    const reader = new FsRepoReader();
    expect(await reader.exists(dir)).toBe(true);
  });

  it('exists returns false for a missing path', async () => {
    const reader = new FsRepoReader();
    expect(await reader.exists(join(dir, 'missing'))).toBe(false);
  });

  it('readFile returns the file contents as utf-8 string', async () => {
    const file = join(dir, 'a.txt');
    await fs.writeFile(file, 'hello\n');
    const reader = new FsRepoReader();
    expect(await reader.readFile(file)).toBe('hello\n');
  });
});
