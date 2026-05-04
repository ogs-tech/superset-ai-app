import { describe, expect, it } from 'vitest';
import { PluginManifestParser } from '../../../../src/main/application/services/plugin-manifest-parser.js';
import { InMemoryFileSystem } from '../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';
import { ManifestInvalidError } from '../../../../src/main/domain/plugin-errors.js';

describe('PluginManifestParser', () => {
  it('parses a valid manifest and returns PluginManifest with correct id and version', async () => {
    const fs = new InMemoryFileSystem();
    fs.createFile(
      '/test-plugin/.claude-plugin/plugin.json',
      JSON.stringify({
        id: 'test-plugin',
        version: '1.0.0',
        description: 'A test plugin',
        artifacts: {
          skills: [],
          agents: [],
          commands: [],
          hooks: false,
          mcp: false,
          lsp: false,
        },
      }),
    );

    const parser = new PluginManifestParser(fs);
    const manifest = await parser.parse('/test-plugin');

    expect(manifest.id).toBe('test-plugin');
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.description).toBe('A test plugin');
  });

  it('throws ManifestInvalidError when file is not found', async () => {
    const fs = new InMemoryFileSystem();
    const parser = new PluginManifestParser(fs);

    await expect(parser.parse('/nonexistent-plugin')).rejects.toThrow(ManifestInvalidError);
  });

  it('throws ManifestInvalidError with correct error details when file is not found', async () => {
    const fs = new InMemoryFileSystem();
    const parser = new PluginManifestParser(fs);

    try {
      await parser.parse('/nonexistent-plugin');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ManifestInvalidError);
      const manifestErr = err as ManifestInvalidError;
      expect(manifestErr.name).toBe('ManifestInvalidError');
      expect(manifestErr.details?.path).toBe('/nonexistent-plugin/.claude-plugin/plugin.json');
    }
  });

  it('throws ManifestInvalidError when JSON is invalid', async () => {
    const fs = new InMemoryFileSystem();
    fs.createFile('/test-plugin/.claude-plugin/plugin.json', '{invalid json}');

    const parser = new PluginManifestParser(fs);

    await expect(parser.parse('/test-plugin')).rejects.toThrow(ManifestInvalidError);
  });

  it('throws ManifestInvalidError with correct error details when JSON is invalid', async () => {
    const fs = new InMemoryFileSystem();
    fs.createFile('/test-plugin/.claude-plugin/plugin.json', '{invalid json}');

    const parser = new PluginManifestParser(fs);

    try {
      await parser.parse('/test-plugin');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ManifestInvalidError);
      const manifestErr = err as ManifestInvalidError;
      expect(manifestErr.name).toBe('ManifestInvalidError');
      expect(manifestErr.message).toBe('Invalid JSON in manifest');
      expect(manifestErr.details?.path).toBe('/test-plugin/.claude-plugin/plugin.json');
      expect(manifestErr.details?.reason).toBeDefined();
    }
  });

  it('throws ManifestInvalidError when schema validation fails due to bad id', async () => {
    const fs = new InMemoryFileSystem();
    fs.createFile(
      '/test-plugin/.claude-plugin/plugin.json',
      JSON.stringify({
        id: 'invalid id with spaces',
        version: '1.0.0',
      }),
    );

    const parser = new PluginManifestParser(fs);

    await expect(parser.parse('/test-plugin')).rejects.toThrow(ManifestInvalidError);
  });

  it('throws ManifestInvalidError with correct error details when schema validation fails', async () => {
    const fs = new InMemoryFileSystem();
    fs.createFile(
      '/test-plugin/.claude-plugin/plugin.json',
      JSON.stringify({
        id: 'invalid id with spaces',
        version: '1.0.0',
      }),
    );

    const parser = new PluginManifestParser(fs);

    try {
      await parser.parse('/test-plugin');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ManifestInvalidError);
      const manifestErr = err as ManifestInvalidError;
      expect(manifestErr.name).toBe('ManifestInvalidError');
      expect(manifestErr.message).toBe('Invalid manifest schema');
      expect(manifestErr.details?.path).toBe('/test-plugin/.claude-plugin/plugin.json');
      expect(manifestErr.details?.reason).toBeDefined();
    }
  });
});
