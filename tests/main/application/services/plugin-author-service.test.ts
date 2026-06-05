import { describe, it, expect, beforeEach } from 'vitest';
import { PluginAuthorService } from '../../../../src/main/application/services/plugin-author-service.js';
import type {
  PluginInstallerLike,
  PluginManifestParserLike,
} from '../../../../src/main/application/services/plugin-author-service.js';
import { FakePluginCachePort } from '../../../../src/main/application/services/__fixtures__/fake-plugin-cache-port.js';
import {
  OwnPluginIdCollisionError,
  OperationNotAllowedForOriginError,
} from '../../../../src/main/domain/plugin-errors.js';
import { pluginId } from '../../../../src/main/domain/plugin-id.js';
import { semVer } from '../../../../src/main/domain/semver.js';
import type { PluginId } from '../../../../src/main/domain/plugin-id.js';
import type { PluginManifest } from '../../../../src/main/domain/plugin-manifest.js';
import type { Scope } from '../../../../src/main/application/ports/scope.js';
import type { PluginSummary } from '../../../../src/main/application/services/plugin-installer.js';
import type { MetaFile } from '../../../../src/main/application/schemas/meta-file.schema.js';

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

class FakePluginInstaller implements PluginInstallerLike {
  installed: Array<{ origin: string; id: string; scope: string }> = [];
  uninstalled: string[] = [];

  async install(input: {
    origin: string;
    id: PluginId;
    pluginDir: string;
    scope: Scope;
  }): Promise<PluginSummary> {
    this.installed.push({ origin: input.origin, id: input.id, scope: input.scope });
    return {
      id: input.id,
      origin: input.origin as 'owned' | 'imported',
      scope: input.scope,
      enabled: true,
      installedAt: new Date().toISOString(),
    };
  }

  async uninstall(id: PluginId, _scope: Scope): Promise<void> {
    this.uninstalled.push(id);
  }
}

class FakePluginManifestParser implements PluginManifestParserLike {
  parseCalls: string[] = [];

  async parse(dir: string): Promise<PluginManifest> {
    this.parseCalls.push(dir);
    return {
      id: pluginId('test'),
      version: semVer('0.1.0'),
      artifacts: { skills: [], agents: [], commands: [], hooks: 0, mcp: false, lsp: false },
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const META_WITH_IMPORTED: MetaFile = {
  version: 2,
  plugins: [
    {
      id: 'existing-imported',
      origin: 'imported',
      installedAt: '2026-01-01T00:00:00Z',
      scope: 'personal',
      enabled: true,
      source: { kind: 'git', url: 'https://github.com/x/y.git' },
      installedRef: { kind: 'sha', value: 'abc123' },
    },
  ],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PluginAuthorService', () => {
  let cache: FakePluginCachePort;
  let installer: FakePluginInstaller;
  let parser: FakePluginManifestParser;
  let service: PluginAuthorService;

  beforeEach(() => {
    cache = new FakePluginCachePort();
    installer = new FakePluginInstaller();
    parser = new FakePluginManifestParser();
    service = new PluginAuthorService({ cache, installer, parser });
  });

  // -------------------------------------------------------------------------
  // create()
  // -------------------------------------------------------------------------

  describe('create()', () => {
    it('happy path — scaffolds, parses, installs, returns PluginSummary', async () => {
      const id = pluginId('my-plugin');
      const version = semVer('1.0.0');

      const summary = await service.create({ id, version, scope: 'personal' });

      // scaffold was called
      expect(cache.getScaffolded(id)).toBeDefined();
      expect(cache.getScaffolded(id)?.id).toBe(id);
      expect(cache.getScaffolded(id)?.version).toBe(version);

      // install was called
      expect(installer.installed).toHaveLength(1);
      expect(installer.installed[0]).toMatchObject({
        origin: 'owned',
        id: 'my-plugin',
        scope: 'personal',
      });

      // summary returned
      expect(summary.id).toBe(id);
      expect(summary.origin).toBe('owned');
      expect(summary.scope).toBe('personal');
      expect(summary.enabled).toBe(true);
    });

    it('throws OwnPluginIdCollisionError when id already exists as imported', async () => {
      cache.seedMeta('personal', META_WITH_IMPORTED);
      const id = pluginId('existing-imported');

      await expect(
        service.create({ id, version: semVer('1.0.0'), scope: 'personal' }),
      ).rejects.toThrow(OwnPluginIdCollisionError);

      await expect(
        service.create({ id, version: semVer('1.0.0'), scope: 'personal' }),
      ).rejects.toThrow(`Plugin id already exists: ${id}`);
    });

    it('throws OwnPluginIdCollisionError when id already exists as owned', async () => {
      const ownedMeta: MetaFile = {
        version: 2,
        plugins: [
          {
            id: 'my-plugin',
            origin: 'owned',
            installedAt: '2026-01-01T00:00:00Z',
            scope: 'personal',
            enabled: true,
          },
        ],
      };
      cache.seedMeta('personal', ownedMeta);
      const id = pluginId('my-plugin');

      await expect(
        service.create({ id, version: semVer('1.0.0'), scope: 'personal' }),
      ).rejects.toThrow(OwnPluginIdCollisionError);
    });

    it('calls parser.parse() after scaffold with the correct pluginDir', async () => {
      const id = pluginId('my-plugin');
      const expectedDir = cache.pluginDir('personal', id);

      await service.create({ id, version: semVer('1.0.0'), scope: 'personal' });

      expect(parser.parseCalls).toContain(expectedDir);
    });
  });

  // -------------------------------------------------------------------------
  // delete()
  // -------------------------------------------------------------------------

  describe('delete()', () => {
    it('happy path — owned plugin triggers uninstall', async () => {
      const ownedMeta: MetaFile = {
        version: 2,
        plugins: [
          {
            id: 'my-plugin',
            origin: 'owned',
            installedAt: '2026-01-01T00:00:00Z',
            scope: 'personal',
            enabled: true,
          },
        ],
      };
      cache.seedMeta('personal', ownedMeta);
      const id = pluginId('my-plugin');

      await service.delete(id, 'personal');

      expect(installer.uninstalled).toContain(id);
    });

    it('throws OperationNotAllowedForOriginError on imported plugin', async () => {
      cache.seedMeta('personal', META_WITH_IMPORTED);
      const id = pluginId('existing-imported');

      await expect(service.delete(id, 'personal')).rejects.toThrow(
        OperationNotAllowedForOriginError,
      );

      await expect(service.delete(id, 'personal')).rejects.toThrow(
        'Cannot delete imported plugin with deleteOwned',
      );
    });

    it('returns silently when plugin is not found (idempotent)', async () => {
      // empty meta
      const id = pluginId('ghost-plugin');

      await expect(service.delete(id, 'personal')).resolves.toBeUndefined();
      expect(installer.uninstalled).toHaveLength(0);
    });
  });
});
