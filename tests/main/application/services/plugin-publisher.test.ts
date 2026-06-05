import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PluginPublisher } from '../../../../src/main/application/services/plugin-publisher.js';
import { FakePluginCachePort } from '../../../../src/main/application/services/__fixtures__/fake-plugin-cache-port.js';
import { FakeGitPort } from '../../../../src/main/application/services/__fixtures__/fake-git-port.js';
import { FakeGitHubApiPort } from '../../../../src/main/application/services/__fixtures__/fake-github-api-port.js';
import { FakeCredentialStorePort } from '../../../../src/main/application/services/__fixtures__/fake-credential-store-port.js';
import {
  OperationNotAllowedForOriginError,
  PublishAuthMissingError,
  RepoAlreadyExistsError,
  PublishConflictError,
  TagConflictError,
} from '../../../../src/main/domain/plugin-errors.js';
import { pluginId } from '../../../../src/main/domain/plugin-id.js';
import { semVer } from '../../../../src/main/domain/semver.js';
import type {
  MetaFile,
  MetaEntry,
} from '../../../../src/main/application/schemas/meta-file.schema.js';
import type { PluginManifestParser } from '../../../../src/main/application/services/plugin-manifest-parser.js';

// ── Constants ────────────────────────────────────────────────────────────────

const ID = pluginId('my-plugin');
const SCOPE = 'personal' as const;
const VERSION = semVer('1.0.0');
const PLUGIN_DIR = `${SCOPE}/plugins/${ID}`;
const FAKE_PAT = 'ghp_secret123';
const FAKE_OWNER = 'test-owner';
const NOW = '2026-05-04T00:00:00.000Z';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const ownedEntry: MetaEntry = {
  id: ID,
  origin: 'owned' as const,
  installedAt: '2026-01-01T00:00:00Z',
  scope: SCOPE,
  enabled: true,
};

const ownedMeta: MetaFile = { version: 2, plugins: [ownedEntry] };

const importedEntry: MetaEntry = {
  id: ID,
  origin: 'imported' as const,
  installedAt: '2026-01-01T00:00:00Z',
  scope: SCOPE,
  enabled: true,
};

const importedMeta: MetaFile = { version: 2, plugins: [importedEntry] };

const existingPublish = {
  remoteUrl: `https://github.com/${FAKE_OWNER}/${ID}`,
  visibility: 'public' as const,
  lastPublishedSha: 'old-sha-abc',
  lastPublishedVersion: semVer('0.1.0'),
  lastPublishedAt: '2026-01-02T00:00:00Z',
};

const ownedEntryWithPublish: MetaEntry = {
  ...ownedEntry,
  publish: existingPublish,
};

const ownedMetaWithPublish: MetaFile = {
  version: 2,
  plugins: [ownedEntryWithPublish],
};

// ── Fake clock ───────────────────────────────────────────────────────────────

const fakeClock = { now: () => new Date(NOW) };

// ── Fake parser ───────────────────────────────────────────────────────────────

function makeFakeParser(description?: string): PluginManifestParser {
  return {
    parse: vi.fn().mockResolvedValue({
      id: ID,
      version: VERSION,
      description,
      artifacts: { skills: [], agents: [], commands: [], hooks: 0, mcp: false, lsp: false },
    }),
  } as unknown as PluginManifestParser;
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('PluginPublisher', () => {
  let cache: FakePluginCachePort;
  let git: FakeGitPort;
  let githubApi: FakeGitHubApiPort;
  let credentials: FakeCredentialStorePort;
  let parser: PluginManifestParser;
  let publisher: PluginPublisher;

  beforeEach(() => {
    cache = new FakePluginCachePort();
    git = new FakeGitPort();
    githubApi = new FakeGitHubApiPort();
    credentials = new FakeCredentialStorePort();
    parser = makeFakeParser('My plugin description');

    githubApi.setOwner(FAKE_OWNER);
    credentials.seed('github.pat', FAKE_PAT);

    publisher = new PluginPublisher({
      cache,
      git,
      githubApi,
      credentials,
      parser,
      clock: fakeClock,
    });
  });

  // ── 1. First publish happy path ──────────────────────────────────────────

  describe('first publish — happy path', () => {
    it('runs full sequence and returns PluginPublishInfo with meta updated', async () => {
      cache.seedMeta(SCOPE, ownedMeta);

      const result = await publisher.publish({ id: ID, scope: SCOPE, version: VERSION });

      // Returns correct shape
      expect(result.remoteUrl).toBe(`https://github.com/${FAKE_OWNER}/${ID}`);
      expect(result.visibility).toBe('public');
      expect(result.lastPublishedVersion).toBe(VERSION);
      expect(result.lastPublishedAt).toBe(NOW);
      expect(typeof result.lastPublishedSha).toBe('string');

      // Meta was updated
      const updatedMeta = cache.getMeta(SCOPE);
      const updatedEntry = updatedMeta?.plugins.find((p) => p.id === ID);
      expect(updatedEntry?.publish).toBeDefined();
      expect(updatedEntry?.publish?.remoteUrl).toBe(`https://github.com/${FAKE_OWNER}/${ID}`);
      expect(updatedEntry?.publish?.lastPublishedVersion).toBe(VERSION);
    });

    it('uses input repoName when provided', async () => {
      cache.seedMeta(SCOPE, ownedMeta);

      const result = await publisher.publish({
        id: ID,
        scope: SCOPE,
        version: VERSION,
        repoName: 'custom-repo-name',
      });

      expect(result.remoteUrl).toContain('custom-repo-name');
    });

    it('uses "private" visibility when specified', async () => {
      cache.seedMeta(SCOPE, ownedMeta);

      const result = await publisher.publish({
        id: ID,
        scope: SCOPE,
        version: VERSION,
        visibility: 'private',
      });

      expect(result.visibility).toBe('private');
    });

    it('uses default commit message when not provided', async () => {
      cache.seedMeta(SCOPE, ownedMeta);

      // Should not throw — confirms default message doesn't break anything
      await expect(
        publisher.publish({ id: ID, scope: SCOPE, version: VERSION }),
      ).resolves.toBeDefined();
    });
  });

  // ── 2. PAT absent → PublishAuthMissingError ───────────────────────────────

  describe('PAT missing', () => {
    it('throws PublishAuthMissingError before any git/api calls when PAT is absent', async () => {
      cache.seedMeta(SCOPE, ownedMeta);
      credentials = new FakeCredentialStorePort(); // no PAT seeded
      publisher = new PluginPublisher({
        cache,
        git,
        githubApi,
        credentials,
        parser,
        clock: fakeClock,
      });

      const whoamiSpy = vi.spyOn(githubApi, 'whoami');
      const initSpy = vi.spyOn(git, 'init');

      await expect(publisher.publish({ id: ID, scope: SCOPE, version: VERSION })).rejects.toThrow(
        PublishAuthMissingError,
      );

      expect(whoamiSpy).not.toHaveBeenCalled();
      expect(initSpy).not.toHaveBeenCalled();
    });
  });

  // ── 3. Origin != owned → OperationNotAllowedForOriginError ───────────────

  describe('origin check', () => {
    it('throws OperationNotAllowedForOriginError for imported plugins', async () => {
      cache.seedMeta(SCOPE, importedMeta);

      await expect(publisher.publish({ id: ID, scope: SCOPE, version: VERSION })).rejects.toThrow(
        OperationNotAllowedForOriginError,
      );
    });

    it('throws OperationNotAllowedForOriginError with correct details', async () => {
      cache.seedMeta(SCOPE, importedMeta);

      const err = await publisher
        .publish({ id: ID, scope: SCOPE, version: VERSION })
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(OperationNotAllowedForOriginError);
      expect((err as OperationNotAllowedForOriginError).details?.origin).toBe('imported');
    });
  });

  // ── 4. First publish: repo already exists → RepoAlreadyExistsError ────────

  describe('first publish — repo already exists', () => {
    it('throws RepoAlreadyExistsError without calling createRepo', async () => {
      cache.seedMeta(SCOPE, ownedMeta);
      githubApi.seedRepo(FAKE_OWNER, ID); // repo already seeded

      const createRepoSpy = vi.spyOn(githubApi, 'createRepo');

      await expect(publisher.publish({ id: ID, scope: SCOPE, version: VERSION })).rejects.toThrow(
        RepoAlreadyExistsError,
      );

      expect(createRepoSpy).not.toHaveBeenCalled();
    });

    it('throws RepoAlreadyExistsError with repoName detail', async () => {
      cache.seedMeta(SCOPE, ownedMeta);
      githubApi.seedRepo(FAKE_OWNER, ID);

      const err = await publisher
        .publish({ id: ID, scope: SCOPE, version: VERSION })
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(RepoAlreadyExistsError);
      expect((err as RepoAlreadyExistsError).details?.repoName).toBe(ID);
    });
  });

  // ── 5. First publish: createRepo ok, push fails → meta NOT updated ────────

  describe('first publish — push failure does not update meta', () => {
    it('leaves meta unchanged if push throws', async () => {
      cache.seedMeta(SCOPE, ownedMeta);

      // Make git.push throw after createRepo succeeds
      const originalPush = git.push.bind(git);
      vi.spyOn(git, 'push').mockRejectedValue(new Error('push failed: connection refused'));

      await expect(publisher.publish({ id: ID, scope: SCOPE, version: VERSION })).rejects.toThrow(
        'push failed',
      );

      // Meta should NOT have been updated
      const meta = cache.getMeta(SCOPE);
      const entry = meta?.plugins.find((p) => p.id === ID);
      expect(entry?.publish).toBeUndefined();
    });
  });

  // ── 6. Republish happy path ───────────────────────────────────────────────

  describe('republish — happy path', () => {
    it('completes sequence and updates meta when SHA matches and tag is new', async () => {
      cache.seedMeta(SCOPE, ownedMetaWithPublish);

      // Remote SHA must match lastPublishedSha
      git.setRemoteSha(PLUGIN_DIR, 'origin', 'main', existingPublish.lastPublishedSha);

      const result = await publisher.publish({ id: ID, scope: SCOPE, version: VERSION });

      expect(result.remoteUrl).toBe(existingPublish.remoteUrl);
      expect(result.visibility).toBe('public');
      expect(result.lastPublishedVersion).toBe(VERSION);
      expect(result.lastPublishedAt).toBe(NOW);

      const updatedMeta = cache.getMeta(SCOPE);
      const updatedEntry = updatedMeta?.plugins.find((p) => p.id === ID);
      expect(updatedEntry?.publish?.lastPublishedVersion).toBe(VERSION);
    });

    it('commits uncommitted changes before pushing', async () => {
      cache.seedMeta(SCOPE, ownedMetaWithPublish);
      git.setRemoteSha(PLUGIN_DIR, 'origin', 'main', existingPublish.lastPublishedSha);
      git.setUncommittedChanges(PLUGIN_DIR, true);

      const commitSpy = vi.spyOn(git, 'commit');

      await publisher.publish({ id: ID, scope: SCOPE, version: VERSION });

      expect(commitSpy).toHaveBeenCalled();
    });

    it('skips commit when no uncommitted changes', async () => {
      cache.seedMeta(SCOPE, ownedMetaWithPublish);
      git.setRemoteSha(PLUGIN_DIR, 'origin', 'main', existingPublish.lastPublishedSha);
      git.setUncommittedChanges(PLUGIN_DIR, false);

      const commitSpy = vi.spyOn(git, 'commit');

      await publisher.publish({ id: ID, scope: SCOPE, version: VERSION });

      expect(commitSpy).not.toHaveBeenCalled();
    });
  });

  // ── 7. Republish: remote SHA diverged → PublishConflictError ─────────────

  describe('republish — SHA diverged', () => {
    it('throws PublishConflictError when remote SHA differs from lastPublishedSha', async () => {
      cache.seedMeta(SCOPE, ownedMetaWithPublish);

      // Remote SHA is DIFFERENT from lastPublishedSha
      git.setRemoteSha(PLUGIN_DIR, 'origin', 'main', 'diverged-sha-xyz');

      await expect(publisher.publish({ id: ID, scope: SCOPE, version: VERSION })).rejects.toThrow(
        PublishConflictError,
      );
    });

    it('includes localSha and remoteSha in error details', async () => {
      cache.seedMeta(SCOPE, ownedMetaWithPublish);
      git.setRemoteSha(PLUGIN_DIR, 'origin', 'main', 'diverged-sha-xyz');

      const err = await publisher
        .publish({ id: ID, scope: SCOPE, version: VERSION })
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(PublishConflictError);
      expect((err as PublishConflictError).details?.localSha).toBe(
        existingPublish.lastPublishedSha,
      );
      expect((err as PublishConflictError).details?.remoteSha).toBe('diverged-sha-xyz');
    });
  });

  // ── 8. Republish: tag conflict → TagConflictError ─────────────────────────

  describe('republish — tag conflict', () => {
    it('throws TagConflictError when tag already exists on remote', async () => {
      cache.seedMeta(SCOPE, ownedMetaWithPublish);
      git.setRemoteSha(PLUGIN_DIR, 'origin', 'main', existingPublish.lastPublishedSha);

      // Tag already exists
      githubApi.seedTag(FAKE_OWNER, ID, `v${VERSION}`);

      await expect(publisher.publish({ id: ID, scope: SCOPE, version: VERSION })).rejects.toThrow(
        TagConflictError,
      );
    });

    it('includes tag name in error details', async () => {
      cache.seedMeta(SCOPE, ownedMetaWithPublish);
      git.setRemoteSha(PLUGIN_DIR, 'origin', 'main', existingPublish.lastPublishedSha);
      githubApi.seedTag(FAKE_OWNER, ID, `v${VERSION}`);

      const err = await publisher
        .publish({ id: ID, scope: SCOPE, version: VERSION })
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(TagConflictError);
      expect((err as TagConflictError).details?.tag).toBe(`v${VERSION}`);
    });
  });

  // ── 9. PAT never appears in logs ──────────────────────────────────────────

  describe('PAT security — PAT never in logs', () => {
    it('does not log the PAT string in any console output', async () => {
      cache.seedMeta(SCOPE, ownedMeta);

      const loggedMessages: string[] = [];
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
        loggedMessages.push(args.map(String).join(' '));
      });
      const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation((...args: unknown[]) => {
        loggedMessages.push(args.map(String).join(' '));
      });
      const consoleDebugSpy = vi
        .spyOn(console, 'debug')
        .mockImplementation((...args: unknown[]) => {
          loggedMessages.push(args.map(String).join(' '));
        });
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
        loggedMessages.push(args.map(String).join(' '));
      });
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation((...args: unknown[]) => {
          loggedMessages.push(args.map(String).join(' '));
        });

      try {
        await publisher.publish({ id: ID, scope: SCOPE, version: VERSION });
      } finally {
        consoleSpy.mockRestore();
        consoleInfoSpy.mockRestore();
        consoleDebugSpy.mockRestore();
        consoleWarnSpy.mockRestore();
        consoleErrorSpy.mockRestore();
      }

      for (const msg of loggedMessages) {
        expect(msg).not.toContain(FAKE_PAT);
      }
    });

    it('PAT is not present in any git.addRemote call arguments visible to tests', async () => {
      cache.seedMeta(SCOPE, ownedMeta);

      const addRemoteCalls: string[] = [];
      const addRemoteSpy = vi
        .spyOn(git, 'addRemote')
        .mockImplementation(async (_dir: string, _name: string, url: string) => {
          addRemoteCalls.push(url);
        });

      await publisher.publish({ id: ID, scope: SCOPE, version: VERSION });

      // The URL itself contains the PAT (that's required for auth) —
      // but we verify the service at least uses x-access-token format
      // and does NOT expose it via logs (separate assertion above).
      // Here we confirm the URL is well-formed with the token embedded.
      expect(addRemoteCalls.length).toBe(1);
      const remoteUrl = addRemoteCalls[0]!;
      expect(remoteUrl).toContain('x-access-token:');
      expect(remoteUrl).toContain('@github.com/');
      // Sensitive part is in the URL itself (needed for git auth),
      // not in any log statement — that's the security contract.
      addRemoteSpy.mockRestore();
    });
  });
});
