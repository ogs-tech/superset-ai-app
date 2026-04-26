import { afterEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import { FsWorkspaceBootstrap } from '../../../src/main/infrastructure/workspace/fs-workspace-bootstrap.js';
import { DomainError } from '../../../src/main/domain/errors.js';

const errnoError = (code: string): NodeJS.ErrnoException => {
  const err = new Error(`${code}: simulated`) as NodeJS.ErrnoException;
  err.code = code;
  return err;
};

describe('FsWorkspaceBootstrap.mkdirRecursive', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps EACCES from fs.mkdir to a DomainError of kind "io"', async () => {
    vi.spyOn(fs, 'mkdir').mockRejectedValue(errnoError('EACCES'));
    const bootstrap = new FsWorkspaceBootstrap();

    const err = await bootstrap.mkdirRecursive('/tmp/blocked').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).kind).toBe('io');
  });

  it('maps ENOSPC from fs.mkdir to a DomainError of kind "io"', async () => {
    vi.spyOn(fs, 'mkdir').mockRejectedValue(errnoError('ENOSPC'));
    const bootstrap = new FsWorkspaceBootstrap();

    const err = await bootstrap.mkdirRecursive('/tmp/full').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).kind).toBe('io');
  });

  it('maps EROFS from fs.mkdir to a DomainError of kind "io"', async () => {
    vi.spyOn(fs, 'mkdir').mockRejectedValue(errnoError('EROFS'));
    const bootstrap = new FsWorkspaceBootstrap();

    const err = await bootstrap.mkdirRecursive('/tmp/ro').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).kind).toBe('io');
  });

  it('rethrows unknown errors as-is (no DomainError wrapping)', async () => {
    const raw = new Error('mystery');
    vi.spyOn(fs, 'mkdir').mockRejectedValue(raw);
    const bootstrap = new FsWorkspaceBootstrap();

    await expect(bootstrap.mkdirRecursive('/tmp/x')).rejects.toBe(raw);
  });

  it('calls fs.mkdir with recursive: true and resolves on success', async () => {
    const mkdirSpy = vi.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
    const bootstrap = new FsWorkspaceBootstrap();

    await expect(bootstrap.mkdirRecursive('/tmp/ok')).resolves.toBeUndefined();
    expect(mkdirSpy).toHaveBeenCalledWith('/tmp/ok', { recursive: true });
  });
});
