import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MarketplaceService } from '../../../../src/main/application/services/marketplace-service.js';
import { SettingsMarketplaceRepository } from '../../../../src/main/infrastructure/marketplace/settings-marketplace-repository.js';
import { FakeClaudeSettingsPort } from '../../../../src/main/application/services/__fixtures__/fake-claude-settings-port.js';
import { FakeGitPort } from '../../../../src/main/application/services/__fixtures__/fake-git-port.js';
import { InMemoryFileSystem } from '../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';
import { marketplaceId } from '../../../../src/main/domain/marketplace-id.js';
import type { MarketplaceManifest } from '../../../../src/main/domain/marketplace-manifest.js';

describe('MarketplaceService', () => {
  let settings: FakeClaudeSettingsPort;
  let service: MarketplaceService;

  beforeEach(() => {
    settings = new FakeClaudeSettingsPort();
    const repository = new SettingsMarketplaceRepository(settings);
    service = new MarketplaceService({ repository });
  });

  it('list returns empty when no marketplaces are added', async () => {
    expect(await service.list('personal')).toEqual([]);
  });

  it('add then list returns persisted record', async () => {
    await service.add('personal', {
      id: marketplaceId('foo'),
      source: { kind: 'directory', path: '/x' },
    });
    const items = await service.list('personal');
    expect(items).toHaveLength(1);
    expect(items[0]!.id).toBe('foo');
    expect(items[0]!.manifest).toBeUndefined();
  });

  it('addFromUrl clones to a temp dir, moves it into the cache, and registers the marketplace', async () => {
    const manifest: MarketplaceManifest = {
      name: 'cool-marketplace',
      description: 'd',
      plugins: [{ name: 'p1', description: 'plugin 1', source: './plugins/p1' }],
    };
    const parser = { parse: vi.fn().mockResolvedValue(manifest) };
    const git = new FakeGitPort();
    const fs = new InMemoryFileSystem();
    const repository = new SettingsMarketplaceRepository(settings);
    const cloneSpy = vi.spyOn(git, 'clone');
    const tempSpy = vi.spyOn(fs, 'makeTempDir');
    const renameSpy = vi.spyOn(fs, 'rename');
    const withDeps = new MarketplaceService({
      repository,
      parser,
      git,
      cacheDirRoot: () => '/cache',
      fs,
    });

    const result = await withDeps.addFromUrl('personal', 'https://github.com/acme/cool.git');

    expect(result.id).toBe('cool-marketplace');
    expect(result.manifest.name).toBe('cool-marketplace');

    // Cloned into a fresh temp dir, then renamed into the cache (no node:fs in the service).
    expect(tempSpy).toHaveBeenCalledWith('marketplace-add-');
    const tmpDir = await tempSpy.mock.results[0]!.value;
    expect(cloneSpy).toHaveBeenCalledWith('https://github.com/acme/cool.git', undefined, tmpDir);
    expect(renameSpy).toHaveBeenCalledWith(tmpDir, '/cache/cool-marketplace');

    // Registered in the repository.
    const listed = await withDeps.list('personal');
    expect(listed.map((m) => m.id)).toContain('cool-marketplace');
  });

  it('list with parser attaches manifest when parse succeeds', async () => {
    const manifest: MarketplaceManifest = {
      name: 'foo',
      description: 'd',
      plugins: [{ name: 'p1', description: 'plugin 1', source: './plugins/p1' }],
    };
    const parser = { parse: vi.fn().mockResolvedValue(manifest) };
    const repository = new SettingsMarketplaceRepository(settings);
    const withParser = new MarketplaceService({ repository, parser });

    await service.add('personal', {
      id: marketplaceId('foo'),
      source: { kind: 'directory', path: '/x' },
    });

    const items = await withParser.list('personal');
    expect(items[0]!.manifest).toEqual(manifest);
    expect(parser.parse).toHaveBeenCalledWith('/x');
  });

  it('list with parser returns record without manifest when parse fails', async () => {
    const parser = { parse: vi.fn().mockRejectedValue(new Error('not found')) };
    const repository = new SettingsMarketplaceRepository(settings);
    const withParser = new MarketplaceService({ repository, parser });

    await service.add('personal', {
      id: marketplaceId('foo'),
      source: { kind: 'directory', path: '/x' },
    });

    const items = await withParser.list('personal');
    expect(items[0]!.manifest).toBeUndefined();
  });

  it('remove deletes the marketplace', async () => {
    await service.add('personal', {
      id: marketplaceId('foo'),
      source: { kind: 'directory', path: '/x' },
    });
    await service.remove('personal', marketplaceId('foo'));
    expect(await service.list('personal')).toEqual([]);
  });

  it('refresh returns the same as get', async () => {
    await service.add('personal', {
      id: marketplaceId('foo'),
      source: { kind: 'directory', path: '/x' },
    });
    const refreshed = await service.refresh('personal', marketplaceId('foo'));
    expect(refreshed?.id).toBe('foo');
  });

  it('list derives cache path from cacheDirRoot when source has no cachePath', async () => {
    const manifest: MarketplaceManifest = {
      name: 'official',
      description: 'd',
      plugins: [],
    };
    const parser = { parse: vi.fn().mockResolvedValue(manifest) };
    const repository = new SettingsMarketplaceRepository(settings);
    const cacheDirRoot = vi.fn().mockReturnValue('/cache');
    const withParser = new MarketplaceService({ repository, parser, cacheDirRoot });

    await service.add('personal', {
      id: marketplaceId('claude-plugins-official'),
      source: { kind: 'github', repo: 'anthropics/claude-plugins-official' },
    });

    const items = await withParser.list('personal');
    expect(items[0]!.manifest).toEqual(manifest);
    expect(parser.parse).toHaveBeenCalledWith('/cache/claude-plugins-official');
  });

  it('list returns no manifest when source has no cachePath and no cacheDirRoot is configured', async () => {
    const parser = { parse: vi.fn() };
    const repository = new SettingsMarketplaceRepository(settings);
    const withParser = new MarketplaceService({ repository, parser });

    await service.add('personal', {
      id: marketplaceId('claude-plugins-official'),
      source: { kind: 'github', repo: 'anthropics/claude-plugins-official' },
    });

    const items = await withParser.list('personal');
    expect(items[0]!.manifest).toBeUndefined();
    expect(parser.parse).not.toHaveBeenCalled();
  });
});
