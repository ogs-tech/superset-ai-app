import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { FsSettingsRepository } from '../../../src/main/infrastructure/settings/fs-settings-repository.js';
import { getDefaults, type Settings } from '../../../src/shared/settings.js';

const makeSettings = (overrides: Partial<Settings> = {}): Settings => ({
  ...getDefaults(),
  ...overrides,
});

describe('FsSettingsRepository.load', () => {
  let workdir: string;
  let target: string;

  beforeEach(async () => {
    workdir = await mkdtemp(join(tmpdir(), 'sde-fs-repo-'));
    target = join(workdir, 'settings.json');
  });

  afterEach(async () => {
    await rm(workdir, { recursive: true, force: true });
  });

  it('returns null when the settings file does not exist (ENOENT)', async () => {
    const repo = new FsSettingsRepository(target);
    await expect(repo.load()).resolves.toBeNull();
  });

  it('returns the parsed object when the file exists', async () => {
    const persisted = makeSettings({ ui: { theme: 'dark' } });
    await fs.writeFile(target, JSON.stringify(persisted), 'utf8');

    const repo = new FsSettingsRepository(target);
    await expect(repo.load()).resolves.toEqual(persisted);
  });
});

describe('FsSettingsRepository.save', () => {
  let workdir: string;
  let target: string;

  beforeEach(async () => {
    workdir = await mkdtemp(join(tmpdir(), 'sde-fs-repo-'));
    target = join(workdir, 'settings.json');
  });

  afterEach(async () => {
    await rm(workdir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('writes atomically: tempfile lives in the same directory as the target before rename', async () => {
    const repo = new FsSettingsRepository(target);
    const settings = makeSettings({ ui: { theme: 'dark' } });
    const renameSpy = vi.spyOn(fs, 'rename');

    await repo.save(settings);

    expect(renameSpy).toHaveBeenCalledTimes(1);
    const [tempPath, finalPath] = renameSpy.mock.calls[0]!;
    expect(typeof tempPath).toBe('string');
    expect(finalPath).toBe(target);
    expect(dirname(tempPath as string)).toBe(dirname(target));
    expect(tempPath).not.toBe(target);
    await expect(readFile(target, 'utf8').then(JSON.parse)).resolves.toEqual(settings);
  });

  it('preserves the previous version when rename fails and cleans up the tempfile', async () => {
    const v1 = makeSettings({ ui: { theme: 'light' } });
    await fs.writeFile(target, JSON.stringify(v1), 'utf8');
    const v1Bytes = await readFile(target);

    const repo = new FsSettingsRepository(target);
    const v2 = makeSettings({ ui: { theme: 'dark' } });

    const renameSpy = vi.spyOn(fs, 'rename').mockRejectedValueOnce(new Error('boom'));

    await expect(repo.save(v2)).rejects.toThrow('boom');

    const after = await readFile(target);
    expect(after.equals(v1Bytes)).toBe(true);

    const entries = await readdir(workdir);
    expect(entries).toEqual(['settings.json']);
    expect(renameSpy).toHaveBeenCalledTimes(1);
  });
});
