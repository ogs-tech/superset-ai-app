import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MarketplaceService } from '../../../../src/main/application/services/marketplace-service.js';
import { SettingsMarketplaceRepository } from '../../../../src/main/infrastructure/marketplace/settings-marketplace-repository.js';
import { FakeClaudeSettingsPort } from '../../../../src/main/application/services/__fixtures__/fake-claude-settings-port.js';
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
