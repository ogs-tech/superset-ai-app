import { describe, it, expect, beforeEach } from 'vitest';
import { SettingsMarketplaceRepository } from '../../../../src/main/infrastructure/marketplace/settings-marketplace-repository.js';
import { FakeClaudeSettingsPort } from '../../../../src/main/application/services/__fixtures__/fake-claude-settings-port.js';
import { marketplaceId } from '../../../../src/main/domain/marketplace-id.js';

describe('SettingsMarketplaceRepository', () => {
  let settings: FakeClaudeSettingsPort;
  let repo: SettingsMarketplaceRepository;

  beforeEach(() => {
    settings = new FakeClaudeSettingsPort();
    repo = new SettingsMarketplaceRepository(settings);
  });

  it('list returns empty when no marketplaces are configured', async () => {
    const items = await repo.list('personal');
    expect(items).toEqual([]);
  });

  it('add persists a marketplace via settings.mutate', async () => {
    await repo.add('personal', {
      id: marketplaceId('claude-plugins-official'),
      source: { kind: 'directory', path: '/tmp/claude' },
    });

    const items = await repo.list('personal');
    expect(items).toHaveLength(1);
    expect(items[0]!.id).toBe('claude-plugins-official');
    expect(items[0]!.source).toEqual({ kind: 'directory', path: '/tmp/claude' });
  });

  it('get returns null for unknown ID', async () => {
    const item = await repo.get('personal', marketplaceId('unknown'));
    expect(item).toBeNull();
  });

  it('get returns marketplace when present', async () => {
    await repo.add('personal', {
      id: marketplaceId('foo'),
      source: { kind: 'directory', path: '/x' },
    });
    const item = await repo.get('personal', marketplaceId('foo'));
    expect(item).not.toBeNull();
    expect(item?.id).toBe('foo');
  });

  it('remove deletes the marketplace from settings', async () => {
    await repo.add('personal', {
      id: marketplaceId('foo'),
      source: { kind: 'directory', path: '/x' },
    });
    await repo.remove('personal', marketplaceId('foo'));
    const items = await repo.list('personal');
    expect(items).toEqual([]);
  });

  it('list does not affect other scopes', async () => {
    await repo.add('personal', {
      id: marketplaceId('foo'),
      source: { kind: 'directory', path: '/x' },
    });
    expect(await repo.list('project')).toEqual([]);
    expect(await repo.list('personal')).toHaveLength(1);
  });

  it('throws when settings contain unsupported source kind', async () => {
    settings.seedSettings('personal', {
      extraKnownMarketplaces: {
        bad: { source: { source: 'remote' as 'directory', path: '' } as never },
      },
      enabledPlugins: {},
    });
    await expect(repo.list('personal')).rejects.toThrow(/Unsupported marketplace source/);
  });
});
