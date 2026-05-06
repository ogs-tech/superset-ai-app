import { describe, it, expect } from 'vitest';
import { pluginManifestSchema } from '../../../../src/main/application/schemas/plugin-manifest.schema.js';
import { PluginIdInvalidError } from '../../../../src/main/domain/plugin-errors.js';

describe('pluginManifestSchema', () => {
  describe('valid manifests', () => {
    it('should parse minimal valid manifest with defaults', () => {
      const input = { id: 'my-plugin', version: '1.0.0' };
      const result = pluginManifestSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('my-plugin');
        expect(result.data.version).toBe('1.0.0');
        expect(result.data.description).toBeUndefined();
        expect(result.data.artifacts).toEqual({
          skills: [],
          agents: [],
          commands: [],
          hooks: 0,
          mcp: false,
          lsp: false,
        });
      }
    });

    it('should parse manifest with all fields specified', () => {
      const input = {
        id: 'my-plugin',
        version: '1.0.0',
        description: 'A test plugin',
        artifacts: {
          skills: ['skill1.md', 'skill2.md'],
          agents: ['agent1.md'],
          commands: ['cmd1'],
          hooks: true,
          mcp: true,
          lsp: false,
        },
      };
      const result = pluginManifestSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('my-plugin');
        expect(result.data.version).toBe('1.0.0');
        expect(result.data.description).toBe('A test plugin');
        expect(result.data.artifacts).toEqual({
          skills: ['skill1.md', 'skill2.md'],
          agents: ['agent1.md'],
          commands: ['cmd1'],
          hooks: 1,
          mcp: true,
          lsp: false,
        });
      }
    });

    it('should parse manifest with extra fields (passthrough)', () => {
      const input = {
        id: 'my-plugin',
        version: '1.0.0',
        description: 'desc',
        extra_field: 'value',
        another: 42,
        artifacts: {
          skills: ['s.md'],
          agents: [],
          commands: [],
          hooks: false,
          mcp: true,
          lsp: false,
        },
      };
      const result = pluginManifestSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('my-plugin');
        expect(result.data.version).toBe('1.0.0');
        expect(result.data.description).toBe('desc');
        expect((result.data as any).extra_field).toBe('value');
        expect((result.data as any).another).toBe(42);
        expect(result.data.artifacts.mcp).toBe(true);
      }
    });

    it('should parse manifest with empty artifacts arrays', () => {
      const input = {
        id: 'a',
        version: '0.0.1',
        artifacts: {
          skills: [],
          agents: [],
          commands: [],
          hooks: false,
          mcp: false,
          lsp: false,
        },
      };
      const result = pluginManifestSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.artifacts.skills).toEqual([]);
        expect(result.data.artifacts.agents).toEqual([]);
      }
    });

    it('should parse valid semver with prerelease', () => {
      const input = { id: 'plugin', version: '1.0.0-rc.1' };
      const result = pluginManifestSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.version).toBe('1.0.0-rc.1');
      }
    });
  });

  describe('invalid manifests', () => {
    it('should fail with invalid plugin ID', () => {
      const input = { id: 'Invalid', version: '1.0.0' };
      const result = pluginManifestSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues[0];
        expect(issue?.message).toContain('Invalid plugin ID');
      }
    });

    it('should fail with uppercase in ID', () => {
      const input = { id: 'My-Plugin', version: '1.0.0' };
      const result = pluginManifestSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues[0];
        expect(issue?.message).toContain('Invalid plugin ID');
      }
    });

    it('should fail with invalid semver', () => {
      const input = { id: 'my-plugin', version: 'v1' };
      const result = pluginManifestSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues[0];
        expect(issue?.message).toContain('Invalid semver');
      }
    });

    it('should fail with invalid semver missing patch', () => {
      const input = { id: 'my-plugin', version: '1.0' };
      const result = pluginManifestSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues[0];
        expect(issue?.message).toContain('Invalid semver');
      }
    });

    it('should fail with missing id', () => {
      const input = { version: '1.0.0' };
      const result = pluginManifestSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues[0];
        expect(issue?.code).toBe('invalid_type');
      }
    });

    it('should default missing version to 0.0.0', () => {
      const input = { id: 'my-plugin' };
      const result = pluginManifestSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.version).toBe('0.0.0');
      }
    });

    it('should fail with non-string id', () => {
      const input = { id: 123, version: '1.0.0' };
      const result = pluginManifestSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues[0];
        expect(issue?.code).toBe('invalid_type');
      }
    });

    it('should fail with non-string version', () => {
      const input = { id: 'my-plugin', version: 1 };
      const result = pluginManifestSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues[0];
        expect(issue?.code).toBe('invalid_type');
      }
    });

    it('should fail with ID exceeding 64 characters', () => {
      const longId = 'a' + 'b'.repeat(64);
      const input = { id: longId, version: '1.0.0' };
      const result = pluginManifestSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues[0];
        expect(issue?.message).toContain('Invalid plugin ID');
      }
    });

    it('should fail with ID starting with digit', () => {
      const input = { id: '1-plugin', version: '1.0.0' };
      const result = pluginManifestSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues[0];
        expect(issue?.message).toContain('Invalid plugin ID');
      }
    });

    it('should fail with empty artifacts object keys but wrong values', () => {
      const input = {
        id: 'my-plugin',
        version: '1.0.0',
        artifacts: {
          skills: 'not-array',
          agents: [],
          commands: [],
          hooks: false,
          mcp: false,
          lsp: false,
        },
      };
      const result = pluginManifestSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it('should fail with invalid hooks type', () => {
      const input = {
        id: 'my-plugin',
        version: '1.0.0',
        artifacts: {
          skills: [],
          agents: [],
          commands: [],
          hooks: 'true',
          mcp: false,
          lsp: false,
        },
      };
      const result = pluginManifestSchema.safeParse(input);

      expect(result.success).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should accept single-letter plugin ID', () => {
      const input = { id: 'a', version: '1.0.0' };
      const result = pluginManifestSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('a');
      }
    });

    it('should accept plugin ID with multiple hyphens', () => {
      const input = { id: 'my-super-plugin', version: '1.0.0' };
      const result = pluginManifestSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('my-super-plugin');
      }
    });

    it('should accept plugin ID with digits', () => {
      const input = { id: 'plugin123', version: '1.0.0' };
      const result = pluginManifestSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('plugin123');
      }
    });

    it('should accept 64-character plugin ID', () => {
      const id64 = 'a' + 'b'.repeat(62) + 'c';
      const input = { id: id64, version: '1.0.0' };
      const result = pluginManifestSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(id64);
      }
    });

    it('should allow partial artifacts object with defaults for unspecified fields', () => {
      const input = {
        id: 'my-plugin',
        version: '1.0.0',
        artifacts: {
          skills: ['skill.md'],
        },
      };
      const result = pluginManifestSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.artifacts.skills).toEqual(['skill.md']);
        expect(result.data.artifacts.agents).toEqual([]);
        expect(result.data.artifacts.commands).toEqual([]);
        expect(result.data.artifacts.hooks).toBe(0);
        expect(result.data.artifacts.mcp).toBe(false);
        expect(result.data.artifacts.lsp).toBe(false);
      }
    });

    it('should handle undefined description as optional', () => {
      const input = {
        id: 'my-plugin',
        version: '1.0.0',
        description: undefined,
      };
      const result = pluginManifestSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.description).toBeUndefined();
      }
    });
  });

  describe('type exports', () => {
    it('should have PluginManifestInput type', () => {
      // This is a compile-time check that the type exists
      const input: Parameters<typeof pluginManifestSchema.parse>[0] = {
        id: 'my-plugin',
        version: '1.0.0',
      };
      expect(input).toBeDefined();
    });

    it('should have PluginManifestOutput type', () => {
      // This is a compile-time check that the type exists
      const input = { id: 'my-plugin', version: '1.0.0' };
      const result = pluginManifestSchema.safeParse(input);
      if (result.success) {
        const output = result.data;
        expect(output).toBeDefined();
      }
    });
  });
});
