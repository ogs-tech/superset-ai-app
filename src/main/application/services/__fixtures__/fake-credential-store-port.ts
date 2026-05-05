import type { CredentialStorePort } from '../../ports/credential-store-port.js';

export class FakeCredentialStorePort implements CredentialStorePort {
  private tokens: Map<string, string> = new Map();
  private available: boolean = true;

  setAvailable(value: boolean): void {
    this.available = value;
  }

  seed(key: string, value: string): void {
    this.tokens.set(key, value);
  }

  async isAvailable(): Promise<boolean> {
    return this.available;
  }

  async get(key: string): Promise<string | null> {
    return this.tokens.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.tokens.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.tokens.delete(key);
  }
}
