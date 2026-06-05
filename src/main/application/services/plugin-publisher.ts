import type { PluginCachePort } from '../ports/plugin-cache-port.js';
import type { GitPort } from '../ports/git-port.js';
import type { GitHubApiPort } from '../ports/github-api-port.js';
import type { CredentialStorePort } from '../ports/credential-store-port.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { Scope } from '../ports/scope.js';
import type { PluginId } from '../../domain/plugin-id.js';
import type { SemVer } from '../../domain/semver.js';
import type { PluginPublishInfo } from '../../domain/plugin-publish-info.js';
import type { PluginManifestParser } from './plugin-manifest-parser.js';
import {
  OperationNotAllowedForOriginError,
  PublishAuthMissingError,
  RepoAlreadyExistsError,
  PublishConflictError,
  TagConflictError,
} from '../../domain/plugin-errors.js';

export class PluginPublisher {
  constructor(
    private readonly deps: {
      cache: PluginCachePort;
      git: GitPort;
      githubApi: GitHubApiPort;
      credentials: CredentialStorePort;
      parser: PluginManifestParser;
      clock: ClockPort;
    },
  ) {}

  async publish(input: {
    id: PluginId;
    scope: Scope;
    repoName?: string;
    visibility?: 'public' | 'private';
    version: SemVer;
    commitMessage?: string;
  }): Promise<PluginPublishInfo> {
    const { cache, git, githubApi, credentials, parser, clock } = this.deps;
    const {
      id,
      scope,
      repoName: inputRepoName,
      visibility = 'public',
      version,
      commitMessage = `chore: publish v${version}`,
    } = input;

    // 1. Read meta and find the entry
    const meta = await cache.readMeta(scope);
    const entry = meta.plugins.find((p) => p.id === id);
    if (entry == null) {
      throw new OperationNotAllowedForOriginError(`Plugin '${id}' not found in ${scope} scope`, {
        operation: 'publish',
      });
    }

    // 2. Check origin='owned'
    if (entry.origin !== 'owned') {
      throw new OperationNotAllowedForOriginError(
        `Cannot publish plugin with origin '${entry.origin}'; only 'owned' plugins can be published`,
        { origin: entry.origin, operation: 'publish' },
      );
    }

    // 3. Get PAT
    const pat = await credentials.get('github.pat');
    if (pat == null) {
      throw new PublishAuthMissingError(
        'GitHub PAT not found; set a token via credentials.set("github.pat", token)',
      );
    }

    const pluginDir = cache.pluginDir(scope, id);

    // Determine which flow: first publish or republish
    if (entry.publish?.remoteUrl == null) {
      return this.firstPublish({
        pluginDir,
        entry,
        meta,
        scope,
        id,
        inputRepoName,
        visibility,
        version,
        commitMessage,
        pat,
        cache,
        git,
        githubApi,
        parser,
        clock,
      });
    } else {
      return this.republish({
        pluginDir,
        entry,
        meta,
        scope,
        version,
        commitMessage,
        pat,
        cache,
        git,
        githubApi,
        clock,
      });
    }
  }

  private async firstPublish(ctx: {
    pluginDir: string;
    entry: NonNullable<ReturnType<typeof Array.prototype.find>>;
    meta: Awaited<ReturnType<PluginCachePort['readMeta']>>;
    scope: Scope;
    id: PluginId;
    inputRepoName: string | undefined;
    visibility: 'public' | 'private';
    version: SemVer;
    commitMessage: string;
    pat: string;
    cache: PluginCachePort;
    git: GitPort;
    githubApi: GitHubApiPort;
    parser: PluginManifestParser;
    clock: ClockPort;
  }): Promise<PluginPublishInfo> {
    const {
      pluginDir,
      entry,
      meta,
      scope,
      id,
      inputRepoName,
      visibility,
      version,
      commitMessage,
      pat,
      cache,
      git,
      githubApi,
      parser,
      clock,
    } = ctx;

    // 4. whoami
    const { login } = await githubApi.whoami();

    // 5. Resolve repoName
    const repoName = inputRepoName ?? id;

    // 6. Check if repo already exists
    const exists = await githubApi.repoExists({ owner: login, name: repoName });
    if (exists) {
      throw new RepoAlreadyExistsError(
        `Repository '${login}/${repoName}' already exists on GitHub`,
        { repoName },
      );
    }

    // 7. Read manifest for description
    const manifest = await parser.parse(pluginDir);

    // 8. Create repo
    const { htmlUrl } = await githubApi.createRepo({
      name: repoName,
      visibility,
      ...(manifest.description != null && { description: manifest.description }),
    });

    // 9. Init git (idempotent)
    await git.init(pluginDir);

    // 10. Stage all files
    await git.add(pluginDir);

    // 11. Commit
    await git.commit(pluginDir, commitMessage);

    // 12. Build authenticated remote URL and add remote
    const remoteUrl = buildAuthenticatedUrl(pat, login, repoName);
    await git.addRemote(pluginDir, 'origin', remoteUrl);

    // 13. Push main branch
    await git.push(pluginDir, 'origin', 'main', { setUpstream: true });

    // 14. Tag
    const tagName = `v${version}`;
    await git.tag(pluginDir, tagName);

    // 15. Push tag
    await git.push(pluginDir, 'origin', tagName);

    // 16. Get current SHA
    const sha = await git.currentSha(pluginDir);

    // 17. Update meta
    const publishInfo: PluginPublishInfo = {
      remoteUrl: htmlUrl,
      visibility,
      lastPublishedSha: sha,
      lastPublishedVersion: version,
      lastPublishedAt: clock.now().toISOString(),
    };

    const updatedMeta = {
      ...meta,
      plugins: meta.plugins.map((p) => (p.id === entry.id ? { ...p, publish: publishInfo } : p)),
    };
    await cache.writeMeta(scope, updatedMeta);

    return publishInfo;
  }

  private async republish(ctx: {
    pluginDir: string;
    entry: NonNullable<ReturnType<typeof Array.prototype.find>>;
    meta: Awaited<ReturnType<PluginCachePort['readMeta']>>;
    scope: Scope;
    version: SemVer;
    commitMessage: string;
    pat: string;
    cache: PluginCachePort;
    git: GitPort;
    githubApi: GitHubApiPort;
    clock: ClockPort;
  }): Promise<PluginPublishInfo> {
    const {
      pluginDir,
      entry,
      meta,
      scope,
      version,
      commitMessage,
      pat,
      cache,
      git,
      githubApi,
      clock,
    } = ctx;

    const existingPublish = entry.publish!;

    // Parse owner/repoName from the stored htmlUrl
    // Format: https://github.com/{owner}/{repoName}
    const { owner, repoName } = parseGithubUrl(existingPublish.remoteUrl);

    // 1. Fetch from origin
    await git.fetch(pluginDir, 'origin');

    // 2. Check remote SHA matches stored lastPublishedSha
    const remoteSha = await git.remoteSha(pluginDir, 'origin', 'main');
    if (remoteSha !== existingPublish.lastPublishedSha) {
      const details: { localSha?: string; remoteSha?: string } = {
        localSha: existingPublish.lastPublishedSha,
      };
      if (remoteSha != null) {
        details.remoteSha = remoteSha;
      }
      throw new PublishConflictError(
        `Remote branch has diverged from last published state. ` +
          `Expected SHA '${existingPublish.lastPublishedSha}' but remote has '${remoteSha ?? 'null'}'. ` +
          `Resolve the conflict before republishing.`,
        details,
      );
    }

    // 3. Check tag doesn't already exist
    const tagName = `v${version}`;
    const tagAlreadyExists = await githubApi.tagExists({ owner, name: repoName, tag: tagName });
    if (tagAlreadyExists) {
      throw new TagConflictError(`Tag '${tagName}' already exists on '${owner}/${repoName}'`, {
        tag: tagName,
      });
    }

    // 4. Commit uncommitted changes if any
    const hasChanges = await git.hasUncommittedChanges(pluginDir);
    if (hasChanges) {
      await git.add(pluginDir);
      await git.commit(pluginDir, commitMessage);
    }

    // 5. Push main
    await git.push(pluginDir, 'origin', 'main');

    // 6. Tag and push tag
    await git.tag(pluginDir, tagName);
    await git.push(pluginDir, 'origin', tagName);

    // 7. Get current SHA
    const sha = await git.currentSha(pluginDir);

    // 8. Update meta
    const publishInfo: PluginPublishInfo = {
      remoteUrl: existingPublish.remoteUrl,
      visibility: existingPublish.visibility,
      lastPublishedSha: sha,
      lastPublishedVersion: version,
      lastPublishedAt: clock.now().toISOString(),
    };

    const updatedMeta = {
      ...meta,
      plugins: meta.plugins.map((p) => (p.id === entry.id ? { ...p, publish: publishInfo } : p)),
    };
    await cache.writeMeta(scope, updatedMeta);

    return publishInfo;
  }
}

/**
 * Build an authenticated remote URL with PAT injected.
 * The PAT is embedded as: https://x-access-token:<PAT>@github.com/owner/repoName.git
 * WARNING: never log this URL.
 */
function buildAuthenticatedUrl(pat: string, owner: string, repoName: string): string {
  return `https://x-access-token:${pat}@github.com/${owner}/${repoName}.git`;
}

/**
 * Parse owner and repoName from a GitHub HTML URL.
 * Expected format: https://github.com/{owner}/{repoName}
 */
function parseGithubUrl(htmlUrl: string): { owner: string; repoName: string } {
  const url = new URL(htmlUrl);
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length < 2 || !parts[0] || !parts[1]) {
    throw new Error(`Cannot parse GitHub URL: ${htmlUrl}`);
  }
  return { owner: parts[0], repoName: parts[1] };
}
