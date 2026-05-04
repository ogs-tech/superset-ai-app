import nock from 'nock';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { OctokitClient } from '../../../../src/main/infrastructure/github/octokit-client.js';
import { PublishAuthMissingError } from '../../../../src/main/domain/plugin-errors.js';

const API = 'https://api.github.com';
const TOKEN = 'ghp_test_token';
// Octokit v22 sends "token <pat>" in the Authorization header
const authHeader = /^token /;

const makeClient = (token: string | null = TOKEN) =>
  new OctokitClient(() => Promise.resolve(token));

beforeEach(() => {
  nock.cleanAll();
});

afterEach(() => {
  nock.cleanAll();
});

describe('OctokitClient', () => {
  describe('PAT absent', () => {
    it('throws PublishAuthMissingError when token is null', async () => {
      const client = makeClient(null);
      await expect(client.whoami()).rejects.toBeInstanceOf(PublishAuthMissingError);
    });

    it('throws PublishAuthMissingError for any method when token is null', async () => {
      const client = makeClient(null);
      await expect(client.repoExists({ owner: 'o', name: 'n' })).rejects.toBeInstanceOf(
        PublishAuthMissingError,
      );
    });
  });

  describe('whoami', () => {
    it('returns login from GET /user', async () => {
      nock(API).get('/user').matchHeader('authorization', authHeader).reply(200, {
        login: 'testuser',
      });

      const client = makeClient();
      const result = await client.whoami();
      expect(result).toEqual({ login: 'testuser' });
    });
  });

  describe('repoExists', () => {
    it('returns true when repo is found (200)', async () => {
      nock(API)
        .get('/repos/owner/name')
        .matchHeader('authorization', authHeader)
        .reply(200, { id: 1 });

      const client = makeClient();
      const result = await client.repoExists({ owner: 'owner', name: 'name' });
      expect(result).toBe(true);
    });

    it('returns false when repo is not found (404)', async () => {
      nock(API)
        .get('/repos/owner/name')
        .matchHeader('authorization', authHeader)
        .reply(404, { message: 'Not Found' });

      const client = makeClient();
      const result = await client.repoExists({ owner: 'owner', name: 'name' });
      expect(result).toBe(false);
    });
  });

  describe('tagExists', () => {
    it('returns true when tag is found (200)', async () => {
      // Octokit sends GET /repos/:owner/:repo/git/ref/:ref (singular "ref")
      // and URL-encodes the slash in the tag ref as %2F
      nock(API)
        .get('/repos/owner/name/git/ref/tags%2Fv1.0.0')
        .matchHeader('authorization', authHeader)
        .reply(200, { ref: 'refs/tags/v1.0.0' });

      const client = makeClient();
      const result = await client.tagExists({ owner: 'owner', name: 'name', tag: 'v1.0.0' });
      expect(result).toBe(true);
    });

    it('returns false when tag is not found (404)', async () => {
      nock(API)
        .get('/repos/owner/name/git/ref/tags%2Fv1.0.0')
        .matchHeader('authorization', authHeader)
        .reply(404, { message: 'Not Found' });

      const client = makeClient();
      const result = await client.tagExists({ owner: 'owner', name: 'name', tag: 'v1.0.0' });
      expect(result).toBe(false);
    });
  });

  describe('createRepo', () => {
    it('returns correct shape for public repo', async () => {
      nock(API)
        .post('/user/repos', (body) => body.private === false)
        .matchHeader('authorization', authHeader)
        .reply(201, {
          clone_url: 'https://github.com/testuser/my-plugin.git',
          html_url: 'https://github.com/testuser/my-plugin',
          owner: { login: 'testuser' },
        });

      const client = makeClient();
      const result = await client.createRepo({ name: 'my-plugin', visibility: 'public' });
      expect(result).toEqual({
        cloneUrl: 'https://github.com/testuser/my-plugin.git',
        htmlUrl: 'https://github.com/testuser/my-plugin',
        owner: 'testuser',
      });
    });

    it('maps visibility "private" to private: true in request body', async () => {
      let capturedBody: Record<string, unknown> = {};
      nock(API)
        .post('/user/repos', (body) => {
          capturedBody = body as Record<string, unknown>;
          return body.private === true;
        })
        .matchHeader('authorization', authHeader)
        .reply(201, {
          clone_url: 'https://github.com/testuser/my-private-plugin.git',
          html_url: 'https://github.com/testuser/my-private-plugin',
          owner: { login: 'testuser' },
        });

      const client = makeClient();
      await client.createRepo({ name: 'my-private-plugin', visibility: 'private' });
      expect(capturedBody.private).toBe(true);
    });
  });
});
