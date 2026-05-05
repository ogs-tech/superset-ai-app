import { describe, expect, it } from 'vitest';
import { createDispatcher } from '../../../src/main/ipc/dispatcher.js';
import { buildCredentialsHandlers } from '../../../src/main/ipc/credentials-handlers.js';
import { FakeCredentialStorePort } from '../../../src/main/application/services/__fixtures__/fake-credential-store-port.js';

describe('buildCredentialsHandlers', () => {
  describe('credentials.setGithubToken', () => {
    it('stores the token in the credential store', async () => {
      const credentialStore = new FakeCredentialStorePort();
      const dispatch = createDispatcher(buildCredentialsHandlers(credentialStore));

      const result = await dispatch('credentials.setGithubToken', { token: 'ghp_test123' });

      expect(result.ok).toBe(true);
      const stored = await credentialStore.get('github.pat');
      expect(stored).toBe('ghp_test123');
    });

    it('throws validation error when token is missing', async () => {
      const credentialStore = new FakeCredentialStorePort();
      const dispatch = createDispatcher(buildCredentialsHandlers(credentialStore));

      const result = await dispatch('credentials.setGithubToken', {});

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.kind).toBe('validation');
      expect(result.error.message).toContain('token');
    });

    it('throws validation error when token is empty string', async () => {
      const credentialStore = new FakeCredentialStorePort();
      const dispatch = createDispatcher(buildCredentialsHandlers(credentialStore));

      const result = await dispatch('credentials.setGithubToken', { token: '' });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.kind).toBe('validation');
      expect(result.error.message).toContain('token');
    });

    it('throws validation error when payload is invalid', async () => {
      const credentialStore = new FakeCredentialStorePort();
      const dispatch = createDispatcher(buildCredentialsHandlers(credentialStore));

      const result = await dispatch('credentials.setGithubToken', 'not-an-object');

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.kind).toBe('validation');
      expect(result.error.message).toContain('payload');
    });
  });

  describe('credentials.clearGithubToken', () => {
    it('removes the token from the credential store', async () => {
      const credentialStore = new FakeCredentialStorePort();
      credentialStore.seed('github.pat', 'ghp_test123');
      const dispatch = createDispatcher(buildCredentialsHandlers(credentialStore));

      const result = await dispatch('credentials.clearGithubToken', {});

      expect(result.ok).toBe(true);
      const stored = await credentialStore.get('github.pat');
      expect(stored).toBeNull();
    });

    it('succeeds even when no token exists', async () => {
      const credentialStore = new FakeCredentialStorePort();
      const dispatch = createDispatcher(buildCredentialsHandlers(credentialStore));

      const result = await dispatch('credentials.clearGithubToken', {});

      expect(result.ok).toBe(true);
    });
  });

  describe('credentials.hasGithubToken', () => {
    it('returns { hasToken: true } when token exists', async () => {
      const credentialStore = new FakeCredentialStorePort();
      credentialStore.seed('github.pat', 'ghp_test123');
      const dispatch = createDispatcher(buildCredentialsHandlers(credentialStore));

      const result = await dispatch('credentials.hasGithubToken', {});

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data).toEqual({ hasToken: true });
    });

    it('returns { hasToken: false } when token does not exist', async () => {
      const credentialStore = new FakeCredentialStorePort();
      const dispatch = createDispatcher(buildCredentialsHandlers(credentialStore));

      const result = await dispatch('credentials.hasGithubToken', {});

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data).toEqual({ hasToken: false });
    });

    it('CRITICAL: never exposes the actual token value', async () => {
      const credentialStore = new FakeCredentialStorePort();
      credentialStore.seed('github.pat', 'ghp_secrettoken123');
      const dispatch = createDispatcher(buildCredentialsHandlers(credentialStore));

      const result = await dispatch('credentials.hasGithubToken', {});

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const responseString = JSON.stringify(result.data);
      expect(responseString).not.toContain('ghp_secrettoken123');
      expect(responseString).not.toContain('github.pat');
    });
  });
});
