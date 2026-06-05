import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type {
  MarketplaceRecord,
  MarketplaceRepository,
  MarketplaceSourceRecord,
} from '../ports/marketplace-repository.js';
import type { Scope } from '../ports/scope.js';
import type { GitPort } from '../ports/git-port.js';
import {
  marketplaceId,
  tryMarketplaceId,
  type MarketplaceId,
} from '../../domain/marketplace-id.js';
import type { MarketplaceManifest, MarketplacePlugin } from '../../domain/marketplace-manifest.js';
import { normalizeGitUrl } from '../../domain/plugin-source.js';

export interface MarketplaceSummary extends MarketplaceRecord {
  manifest?: MarketplaceManifest;
}

export interface MarketplaceParserLike {
  parse(dir: string): Promise<MarketplaceManifest>;
}

export interface MarketplaceServiceDeps {
  repository: MarketplaceRepository;
  parser?: MarketplaceParserLike;
  git?: GitPort;
  cacheDirRoot?: (scope: Scope) => string;
}

export class MarketplaceService {
  constructor(private readonly deps: MarketplaceServiceDeps) {}

  async list(scope: Scope): Promise<MarketplaceSummary[]> {
    const records = await this.deps.repository.list(scope);
    if (!this.deps.parser) {
      return records.map((r) => ({ ...r }));
    }
    const summaries: MarketplaceSummary[] = [];
    for (const record of records) {
      const dir = this.manifestDirFor(scope, record.id, record.source);
      if (dir == null) {
        summaries.push({ ...record });
        continue;
      }
      try {
        const manifest = await this.deps.parser.parse(dir);
        summaries.push({ ...record, manifest: expandManifestSources(manifest, record.source) });
      } catch {
        summaries.push({ ...record });
      }
    }
    return summaries;
  }

  async get(scope: Scope, id: MarketplaceId): Promise<MarketplaceSummary | null> {
    const record = await this.deps.repository.get(scope, id);
    if (!record) return null;
    if (!this.deps.parser) return { ...record };
    const dir = this.manifestDirFor(scope, record.id, record.source);
    if (dir == null) return { ...record };
    try {
      const manifest = await this.deps.parser.parse(dir);
      return { ...record, manifest: expandManifestSources(manifest, record.source) };
    } catch {
      return { ...record };
    }
  }

  private manifestDirFor(
    scope: Scope,
    id: MarketplaceId,
    source: MarketplaceSourceRecord,
  ): string | null {
    if (source.kind === 'directory') return source.path;
    if (source.cachePath != null) return source.cachePath;
    const { cacheDirRoot } = this.deps;
    if (cacheDirRoot == null) return null;
    return path.join(cacheDirRoot(scope), id);
  }

  async add(scope: Scope, record: MarketplaceRecord): Promise<void> {
    await this.deps.repository.add(scope, record);
  }

  async remove(scope: Scope, id: MarketplaceId): Promise<void> {
    const record = await this.deps.repository.get(scope, id);
    await this.deps.repository.remove(scope, id);
    // Best-effort cache cleanup for non-directory marketplaces
    if (record && record.source.kind !== 'directory' && record.source.cachePath) {
      await fs.rm(record.source.cachePath, { recursive: true, force: true }).catch(() => {});
    }
  }

  async refresh(scope: Scope, id: MarketplaceId): Promise<MarketplaceSummary | null> {
    const record = await this.deps.repository.get(scope, id);
    if (!record) return null;

    // For non-directory marketplaces, re-clone into the cache dir
    if (record.source.kind !== 'directory') {
      const { git, cacheDirRoot } = this.deps;
      if (git != null && cacheDirRoot != null) {
        const cachePath = record.source.cachePath ?? path.join(cacheDirRoot(scope), id);
        await fs.rm(cachePath, { recursive: true, force: true }).catch(() => {});
        const url = sourceCloneUrl(record.source);
        const ref = sourceRef(record.source);
        await git.clone(url, ref ? { kind: 'branch', value: ref } : undefined, cachePath);
        // Persist cachePath if it wasn't set
        if (record.source.cachePath !== cachePath) {
          const updated: MarketplaceSourceRecord = { ...record.source, cachePath };
          await this.deps.repository.add(scope, { id, source: updated });
        }
      }
    }

    return this.get(scope, id);
  }

  /**
   * Detect a marketplace at the given URL and register it as a known marketplace.
   * Caches the cloned manifest dir so it can be browsed without re-cloning.
   */
  async addFromUrl(
    scope: Scope,
    url: string,
  ): Promise<{ id: MarketplaceId; manifest: MarketplaceManifest }> {
    const { git, parser, cacheDirRoot, repository } = this.deps;
    if (git == null || parser == null || cacheDirRoot == null) {
      throw new Error('MarketplaceService.addFromUrl requires git, parser, and cacheDirRoot deps');
    }

    const normalizedUrl = normalizeGitUrl(url);

    // Clone to a temp dir first to read the manifest
    const tmpDir = path.join(
      os.tmpdir(),
      `marketplace-add-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );

    let manifest: MarketplaceManifest;
    try {
      await git.clone(normalizedUrl, undefined, tmpDir);
      manifest = await parser.parse(tmpDir);
    } catch (err) {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      throw err;
    }

    // Derive marketplace id: prefer manifest.name, fall back to repo name
    const candidateId = sanitizeMarketplaceId(manifest.name) ?? deriveIdFromUrl(normalizedUrl);
    if (candidateId == null) {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      throw new Error(`Cannot derive marketplace id from manifest or URL: ${url}`);
    }

    // Ensure unique id within the scope
    const existingIds = new Set((await repository.list(scope)).map((m) => m.id as string));
    let finalId = candidateId;
    let counter = 2;
    while (existingIds.has(finalId)) {
      const next = `${candidateId}-${counter}`;
      const result = tryMarketplaceId(next);
      if (!result.ok) break;
      finalId = result.value;
      counter += 1;
      if (counter > 50) break;
    }

    const id = marketplaceId(finalId);

    // Move the clone to the persistent cache dir
    const cachePath = path.join(cacheDirRoot(scope), id);
    await fs.rm(cachePath, { recursive: true, force: true }).catch(() => {});
    await fs.mkdir(path.dirname(cachePath), { recursive: true });
    await fs.rename(tmpDir, cachePath);

    // Build source record (prefer github when URL matches)
    const source = buildSourceFromUrl(normalizedUrl, cachePath);

    await repository.add(scope, { id, source });

    return { id, manifest: expandManifestSources(manifest, source) };
  }
}

function expandManifestSources(
  manifest: MarketplaceManifest,
  source: MarketplaceSourceRecord,
): MarketplaceManifest {
  const url = sourceUrlForExpansion(source);
  if (url == null) return manifest;
  return {
    ...manifest,
    plugins: manifest.plugins.map((p) => expandLocalPluginSource(p, url)),
  };
}

function sourceUrlForExpansion(source: MarketplaceSourceRecord): string | null {
  if (source.kind === 'github') return `https://github.com/${source.repo}.git`;
  if (source.kind === 'git') return source.url;
  if (source.kind === 'url') return source.url;
  return null;
}

function expandLocalPluginSource(
  plugin: MarketplacePlugin,
  marketplaceUrl: string,
): MarketplacePlugin {
  if (typeof plugin.source !== 'string') return plugin;
  const localPath = plugin.source.replace(/^\.\//, '');
  return {
    ...plugin,
    source: { source: 'git-subdir', url: marketplaceUrl, path: localPath },
  };
}

function sourceCloneUrl(source: MarketplaceSourceRecord): string {
  if (source.kind === 'github') return `https://github.com/${source.repo}.git`;
  if (source.kind === 'git' || source.kind === 'url') return source.url;
  throw new Error(`Cannot derive clone URL from source kind '${source.kind}'`);
}

function sourceRef(source: MarketplaceSourceRecord): string | undefined {
  if (source.kind === 'git') return source.ref;
  return undefined;
}

function sanitizeMarketplaceId(raw: string): string | null {
  const lowered = raw.toLowerCase().trim();
  // Replace anything that is not a-z0-9 with hyphens, collapse, trim hyphens
  const cleaned = lowered
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  if (cleaned.length === 0) return null;
  if (!/^[a-z]/.test(cleaned)) return null;
  return cleaned;
}

function deriveIdFromUrl(url: string): string | null {
  // Match GitHub-style URLs to extract owner/repo
  const m = url.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (m && m[2]) return sanitizeMarketplaceId(m[2]);
  // Fallback: last path segment
  const last = url.split('/').filter(Boolean).pop();
  if (last) return sanitizeMarketplaceId(last.replace(/\.git$/, ''));
  return null;
}

function buildSourceFromUrl(url: string, cachePath: string): MarketplaceSourceRecord {
  const githubMatch = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (githubMatch && githubMatch[1] && githubMatch[2]) {
    return {
      kind: 'github',
      repo: `${githubMatch[1]}/${githubMatch[2]}`,
      cachePath,
    };
  }
  return { kind: 'git', url, cachePath };
}
