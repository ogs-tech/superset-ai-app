import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RepoService } from '../../../../src/main/application/services/repo-service.js';
import type { RepoReader } from '../../../../src/main/application/ports/repo-reader.js';

const FIXTURES = join(process.cwd(), 'tests', 'fixtures', 'git-head');

const reader = (
  existingPaths: ReadonlySet<string>,
  headFixtureFile: string | null,
): RepoReader => ({
  exists: (path: string) => Promise.resolve(existingPaths.has(path)),
  readFile: async (path: string) => {
    if (headFixtureFile == null) {
      throw Object.assign(new Error(`ENOENT: ${path}`), { code: 'ENOENT' });
    }
    return readFile(join(FIXTURES, headFixtureFile), 'utf8');
  },
});

describe('RepoService.detectGit', () => {
  it('returns true when a .git directory exists at the path', async () => {
    const service = new RepoService(reader(new Set(['/repo/.git']), null));

    await expect(service.detectGit('/repo')).resolves.toBe(true);
  });

  it('returns false when no .git directory exists at the path', async () => {
    const service = new RepoService(reader(new Set(), null));

    await expect(service.detectGit('/repo')).resolves.toBe(false);
  });
});

describe('RepoService.getCurrentBranch', () => {
  it('returns the branch when HEAD points to a loose ref present on disk', async () => {
    const existing = new Set(['/repo/.git/HEAD', '/repo/.git/refs/heads/main']);
    const service = new RepoService(reader(existing, 'head-ref.txt'));

    await expect(service.getCurrentBranch('/repo')).resolves.toBe('main');
  });

  it('returns null for detached HEAD (sha only)', async () => {
    const service = new RepoService(reader(new Set(['/repo/.git/HEAD']), 'head-detached.txt'));

    await expect(service.getCurrentBranch('/repo')).resolves.toBeNull();
  });

  it('returns null when HEAD references a branch only available in packed-refs', async () => {
    const existing = new Set(['/repo/.git/HEAD']);
    const service = new RepoService(reader(existing, 'head-packed-refs.txt'));

    await expect(service.getCurrentBranch('/repo')).resolves.toBeNull();
  });

  it('returns null when HEAD content is unrecognized garbage', async () => {
    const service = new RepoService(reader(new Set(['/repo/.git/HEAD']), 'head-garbage.txt'));

    await expect(service.getCurrentBranch('/repo')).resolves.toBeNull();
  });

  it('returns null when .git/HEAD is missing without throwing', async () => {
    const service = new RepoService(reader(new Set(), null));

    await expect(service.getCurrentBranch('/repo')).resolves.toBeNull();
  });
});
