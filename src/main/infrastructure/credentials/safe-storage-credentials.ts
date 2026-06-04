import { safeStorage } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type { CredentialStorePort } from '../../application/ports/credential-store-port.js';
import { CredentialStoreUnavailableError } from '../../domain/plugin-errors.js';

type CredentialsStore = Record<string, string>; // key → encrypted base64

export class SafeStorageCredentials implements CredentialStorePort {
  private storePath: string;
  private _available: boolean | undefined;

  constructor(userData: string) {
    this.storePath = join(userData, 'credentials.enc');
  }

  async isAvailable(): Promise<boolean> {
    if (this._available === undefined) {
      this._available = safeStorage.isEncryptionAvailable();
    }
    return this._available;
  }

  async get(key: string): Promise<string | null> {
    await this.assertAvailable();
    const store = await this.readStore();
    const encrypted = store[key];
    if (!encrypted) return null;
    const buf = Buffer.from(encrypted, 'base64');
    return safeStorage.decryptString(buf);
  }

  async set(key: string, value: string): Promise<void> {
    await this.assertAvailable();
    const encrypted = safeStorage.encryptString(value).toString('base64');
    const store = await this.readStore();
    store[key] = encrypted;
    await this.writeStore(store);
  }

  async delete(key: string): Promise<void> {
    await this.assertAvailable();
    const store = await this.readStore();
    delete store[key];
    await this.writeStore(store);
  }

  private async assertAvailable(): Promise<void> {
    if (!(await this.isAvailable())) {
      throw new CredentialStoreUnavailableError('Credential store unavailable: safeStorage not available');
    }
  }

  private async readStore(): Promise<CredentialsStore> {
    try {
      const raw = await readFile(this.storePath, 'utf8');
      return JSON.parse(raw) as CredentialsStore;
    } catch {
      return {};
    }
  }

  private async writeStore(store: CredentialsStore): Promise<void> {
    await mkdir(dirname(this.storePath), { recursive: true });
    await writeFile(this.storePath, JSON.stringify(store), 'utf8');
  }
}
