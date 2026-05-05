import type { IpcHandlers } from './dispatcher.js';
import type { CredentialStorePort } from '../application/ports/credential-store-port.js';
import { DomainError } from '../domain/errors.js';

const GITHUB_PAT_KEY = 'github.pat';

const asString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new DomainError('validation', `Missing or invalid '${field}'`);
  }
  return value;
};

const asObject = (value: unknown, label: string): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new DomainError('validation', `Invalid '${label}' payload`);
  }
  return value as Record<string, unknown>;
};

export function buildCredentialsHandlers(credentialStore: CredentialStorePort): IpcHandlers {
  return {
    'credentials.setGithubToken': async (params) => {
      const raw = asObject(params, 'credentials.setGithubToken');
      const token = asString(raw['token'], 'token');
      await credentialStore.set(GITHUB_PAT_KEY, token);
      // Return nothing (no confirmation needed)
    },

    'credentials.clearGithubToken': async () => {
      await credentialStore.delete(GITHUB_PAT_KEY);
    },

    'credentials.hasGithubToken': async () => {
      const value = await credentialStore.get(GITHUB_PAT_KEY);
      // CRITICAL: return boolean only, NEVER return the token value
      return { hasToken: value !== null };
    },
  };
}
