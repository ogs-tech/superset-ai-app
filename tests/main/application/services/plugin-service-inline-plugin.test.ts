import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PluginService } from '../../../../src/main/application/services/plugin-service.js';
import { PluginManifestParser } from '../../../../src/main/application/services/plugin-manifest-parser.js';
import { NodeFsAdapter } from '../../../../src/main/infrastructure/filesystem/node-fs-adapter.js';
import type { GitPort } from '../../../../src/main/application/ports/git-port.js';
import type { MarketplacePlugin } from '../../../../src/main/domain/marketplace-manifest.js';

/**
 * Inline-defined plugins (official LSP/MCP entries) ship no
 * `.claude-plugin/plugin.json` in their source subdir — only a LICENSE and
 * README. PluginService must synthesize a manifest from the marketplace entry's
 * inline `lspServers`/`mcpServers` block so they can be previewed and installed.
 *
 * These tests drive the real PluginManifestParser against a real temp dir,
 * faking only the clone (which lays down the bare LICENSE+README subdir).
 */
describe('PluginService inline-plugin synthesis', () => {
  let tmpRoots: string[];

  beforeEach(() => {
    tmpRoots = [];
  });

  afterEach(async () => {
    await Promise.all(tmpRoots.map((d) => rm(d, { recursive: true, force: true })));
  });

  // A git fake whose clone reproduces an LSP subdir: a LICENSE, no manifest.
  function bareSubdirGit(): GitPort {
    return {
      async cloneSubdir(_url: string, _subdir: string, _ref: string | undefined, dest: string) {
        await mkdir(dest, { recursive: true });
        await writeFile(path.join(dest, 'LICENSE'), 'Apache 2.0');
        await writeFile(path.join(dest, 'README.md'), '# inline plugin');
        tmpRoots.push(dest);
        return { sha: 'deadbeef' };
      },
    } as Partial<GitPort> as GitPort;
  }

  function makeService(git: GitPort): PluginService {
    const parser = new PluginManifestParser(new NodeFsAdapter());
    // Only git + parser are exercised by previewFromMarketplace; the rest are
    // never called on this path, so undefined stubs are safe.
    return new PluginService({
      git,
      parser,
      installer: undefined,
      author: undefined,
      publisher: undefined,
      cache: undefined,
      settings: undefined,
      marketplaceParser: undefined,
    } as unknown as ConstructorParameters<typeof PluginService>[0]);
  }

  const pyrightEntry: MarketplacePlugin = {
    name: 'pyright-lsp',
    description: 'Python language server (Pyright)',
    // git-subdir source; the fake clone ignores it and lays down a bare subdir.
    source: {
      source: 'git-subdir',
      url: 'https://example.com/official.git',
      path: 'plugins/pyright-lsp',
    },
    // Inline fields carried via the manifest's .passthrough() (not on the type).
    ...({
      version: '1.0.0',
      lspServers: {
        pyright: { command: 'pyright-langserver', args: ['--stdio'] },
      },
    } as Record<string, unknown>),
  };

  it('synthesizes a manifest for an inline LSP plugin (regression: manifest not found)', async () => {
    const manifest = await makeService(bareSubdirGit()).previewFromMarketplace(pyrightEntry);

    expect(manifest.id).toBe('pyright-lsp');
    // The inline lspServers block round-trips through synthesis + real parse —
    // proof the synthesized plugin.json was written and read back.
    expect((manifest as Record<string, unknown>)['lspServers']).toEqual({
      pyright: { command: 'pyright-langserver', args: ['--stdio'] },
    });
  });

  it('does not synthesize for a non-inline plugin (real manifest-not-found still throws)', async () => {
    const plain: MarketplacePlugin = {
      name: 'plain-plugin',
      description: 'no inline servers',
      source: { source: 'git-subdir', url: 'https://example.com/x.git', path: 'plugins/plain' },
    };

    // A bare subdir with no inline block → parser must reject, not synthesize.
    await expect(makeService(bareSubdirGit()).previewFromMarketplace(plain)).rejects.toThrow();
  });
});
