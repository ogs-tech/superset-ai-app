import { describe, it, expect } from 'vitest';
import { metaFileSchema } from '../../../../src/main/application/schemas/meta-file.schema.js';

const validEntryBase = {
  id: 'my-plugin',
  source: { kind: 'git', url: 'https://github.com/owner/my-plugin.git' },
  installedRef: { kind: 'sha', value: 'a1b2c3d4e5f6' },
  installedAt: '2026-05-04T14:30:00Z',
  scope: 'personal',
  enabled: true,
};

describe('metaFileSchema', () => {
  describe('v1 → v2 migration', () => {
    it('migrates a v1 entry (no version field) by setting origin=imported and version=2', () => {
      const input = {
        plugins: [{ ...validEntryBase }],
      };
      const result = metaFileSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.version).toBe(2);
        const first = result.data.plugins.at(0);
        expect(first?.origin).toBe('imported');
      }
    });

    it('migrates a v1 entry (version: 1) by setting origin=imported and version=2', () => {
      const input = {
        version: 1,
        plugins: [{ ...validEntryBase }],
      };
      const result = metaFileSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.version).toBe(2);
        const first = result.data.plugins.at(0);
        expect(first?.origin).toBe('imported');
      }
    });

    it('does not overwrite origin if already present during migration', () => {
      // Entry already has origin — migration must leave it unchanged
      const input = {
        plugins: [{ ...validEntryBase, origin: 'owned' }],
      };
      const result = metaFileSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        const first = result.data.plugins.at(0);
        expect(first?.origin).toBe('owned');
      }
    });
  });

  describe('v2 idempotency', () => {
    it('passes v2 output back in and produces the same result', () => {
      const input = {
        version: 2,
        plugins: [{ ...validEntryBase, origin: 'imported' }],
      };
      const first = metaFileSchema.parse(input);
      const second = metaFileSchema.parse(first);

      expect(second.version).toBe(2);
      const entry = second.plugins.at(0);
      expect(entry?.origin).toBe('imported');
      expect(entry?.id).toBe('my-plugin');
    });
  });

  describe('owned entry with publish block', () => {
    it('parses a v2 owned entry with a publish block', () => {
      const input = {
        version: 2,
        plugins: [
          {
            id: 'my-skill-pack',
            origin: 'owned',
            installedAt: '2026-05-04T15:00:00Z',
            scope: 'personal',
            enabled: true,
            publish: {
              remoteUrl: 'https://github.com/owner/my-skill-pack',
              visibility: 'public',
              lastPublishedSha: '9f8e7d6c5b4a3',
              lastPublishedVersion: '0.2.0',
              lastPublishedAt: '2026-05-04T16:45:00Z',
            },
          },
        ],
      };
      const result = metaFileSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        const entry = result.data.plugins.at(0);
        expect(entry?.origin).toBe('owned');
        expect(entry?.publish?.visibility).toBe('public');
        expect(entry?.publish?.lastPublishedVersion).toBe('0.2.0');
      }
    });
  });

  describe('empty plugins list', () => {
    it('accepts version: 2 with an empty plugins array', () => {
      const input = { version: 2, plugins: [] };
      const result = metaFileSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.plugins).toEqual([]);
      }
    });

    it('defaults plugins to [] when the field is omitted', () => {
      const input = { version: 2 };
      const result = metaFileSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.plugins).toEqual([]);
      }
    });
  });

  describe('invalid inputs', () => {
    it('fails when an entry has an unrecognised origin value', () => {
      const input = {
        version: 2,
        plugins: [{ ...validEntryBase, origin: 'unknown' }],
      };
      const result = metaFileSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it('fails when an entry is missing the required id field', () => {
      const { id: _id, ...entryWithoutId } = validEntryBase;
      const input = {
        version: 2,
        plugins: [{ ...entryWithoutId, origin: 'imported' }],
      };
      const result = metaFileSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it('fails when an entry has an empty id string', () => {
      const input = {
        version: 2,
        plugins: [{ ...validEntryBase, id: '', origin: 'imported' }],
      };
      const result = metaFileSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it('fails when the top-level input is not an object', () => {
      const result = metaFileSchema.safeParse('not-an-object');

      expect(result.success).toBe(false);
    });
  });

  describe('passthrough / unknown fields', () => {
    it('preserves unknown top-level fields', () => {
      const input = {
        version: 2,
        plugins: [],
        _comment: 'managed by plugin-registry',
      };
      const result = metaFileSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as Record<string, unknown>)._comment).toBe(
          'managed by plugin-registry',
        );
      }
    });

    it('preserves unknown entry-level fields', () => {
      const input = {
        version: 2,
        plugins: [{ ...validEntryBase, origin: 'imported', _extra: 42 }],
      };
      const result = metaFileSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data.plugins.at(0) as Record<string, unknown> | undefined)?._extra).toBe(42);
      }
    });
  });
});
