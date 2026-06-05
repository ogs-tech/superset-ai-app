import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SafeStorageCredentials } from '../../../../src/main/infrastructure/credentials/safe-storage-credentials.js';
import { CredentialStoreUnavailableError } from '../../../../src/main/domain/plugin-errors.js';

// Mock electron's safeStorage
vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: vi.fn().mockReturnValue(true),
    encryptString: vi.fn((s: string) => Buffer.from(s + ':encrypted')),
    decryptString: vi.fn((buf: Buffer) => buf.toString().replace(':encrypted', '')),
  },
}));

describe('SafeStorageCredentials', () => {
  let dir: string;
  let credentials: SafeStorageCredentials;

  beforeEach(async () => {
    dir = await fs.mkdtemp(join(tmpdir(), 'safe-storage-credentials-'));
    credentials = new SafeStorageCredentials(dir);
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('set + get round-trip: set and retrieve a credential', async () => {
    await credentials.set('github.pat', 'mytoken');
    const value = await credentials.get('github.pat');
    expect(value).toBe('mytoken');
  });

  it('get returns null for missing key', async () => {
    const value = await credentials.get('nonexistent.key');
    expect(value).toBeNull();
  });

  it('delete removes key: set then delete then get returns null', async () => {
    await credentials.set('test.key', 'testvalue');
    await credentials.delete('test.key');
    const value = await credentials.get('test.key');
    expect(value).toBeNull();
  });

  it('isAvailable=false throws CredentialStoreUnavailableError on set', async () => {
    const { safeStorage } = await import('electron');
    vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValueOnce(false);
    credentials = new SafeStorageCredentials(dir);

    await expect(credentials.set('test.key', 'value')).rejects.toThrow(
      CredentialStoreUnavailableError,
    );
  });

  it('isAvailable=false throws CredentialStoreUnavailableError on get', async () => {
    const { safeStorage } = await import('electron');
    vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValueOnce(false);
    credentials = new SafeStorageCredentials(dir);

    await expect(credentials.get('test.key')).rejects.toThrow(CredentialStoreUnavailableError);
  });

  it('isAvailable=false throws CredentialStoreUnavailableError on delete', async () => {
    const { safeStorage } = await import('electron');
    vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValueOnce(false);
    credentials = new SafeStorageCredentials(dir);

    await expect(credentials.delete('test.key')).rejects.toThrow(CredentialStoreUnavailableError);
  });

  it('isAvailable caches result: call twice, verify mock called once', async () => {
    const { safeStorage } = await import('electron');
    const mockIsEncryptionAvailable = vi.mocked(safeStorage.isEncryptionAvailable);
    mockIsEncryptionAvailable.mockClear();

    await credentials.isAvailable();
    await credentials.isAvailable();

    expect(mockIsEncryptionAvailable).toHaveBeenCalledTimes(1);
  });
});
