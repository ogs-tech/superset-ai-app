import { describe, expect, it } from 'vitest';
import {
  claudeSettingsSchema,
  type ClaudeSettings,
} from '../../../../src/main/application/schemas/claude-settings.schema.js';

describe('claudeSettingsSchema', () => {
  it('parses empty object {} with defaults', () => {
    const input = {};
    const result = claudeSettingsSchema.parse(input);

    expect(result).toEqual({
      extraKnownMarketplaces: {},
      enabledPlugins: {},
    });
  });

  it('parses full settings object with marketplace and enabled plugins', () => {
    const input = {
      extraKnownMarketplaces: {
        local: {
          source: {
            source: 'directory',
            path: '/Users/user/workspace/plugins',
          },
        },
      },
      enabledPlugins: {
        'my-plugin@local': true,
        'other-plugin@local': false,
      },
    };

    const result = claudeSettingsSchema.parse(input);

    expect(result.extraKnownMarketplaces['local']).toEqual({
      source: {
        source: 'directory',
        path: '/Users/user/workspace/plugins',
      },
    });
    expect(result.enabledPlugins['my-plugin@local']).toBe(true);
    expect(result.enabledPlugins['other-plugin@local']).toBe(false);
  });

  it('preserves unknown top-level fields via passthrough', () => {
    const input = {
      extraKnownMarketplaces: {},
      enabledPlugins: {},
      unknownField: 'some-value',
      anotherUnknown: { nested: true },
    };

    const result = claudeSettingsSchema.parse(input);

    expect(result).toEqual({
      extraKnownMarketplaces: {},
      enabledPlugins: {},
      unknownField: 'some-value',
      anotherUnknown: { nested: true },
    });
  });

  it('validates enabledPlugins values are booleans', () => {
    const validInput = {
      enabledPlugins: {
        'plugin@marketplace': true,
        'other-plugin@marketplace': false,
      },
    };

    const result = claudeSettingsSchema.parse(validInput);
    expect(typeof result.enabledPlugins['plugin@marketplace']).toBe('boolean');
    expect(typeof result.enabledPlugins['other-plugin@marketplace']).toBe('boolean');
  });

  it('rejects non-boolean enabledPlugins values', () => {
    const invalidInput = {
      enabledPlugins: {
        'plugin@marketplace': 'true', // string instead of boolean
      },
    };

    expect(() => claudeSettingsSchema.parse(invalidInput)).toThrow();
  });

  it('parses partial settings with only enabledPlugins (extraKnownMarketplaces defaults)', () => {
    const input = {
      enabledPlugins: {
        'my-plugin@local': true,
      },
    };

    const result = claudeSettingsSchema.parse(input);

    expect(result.extraKnownMarketplaces).toEqual({});
    expect(result.enabledPlugins).toEqual({
      'my-plugin@local': true,
    });
  });

  it('parses partial settings with only extraKnownMarketplaces (enabledPlugins defaults)', () => {
    const input = {
      extraKnownMarketplaces: {
        local: {
          source: {
            source: 'directory',
            path: '/Users/user/workspace/plugins',
          },
        },
      },
    };

    const result = claudeSettingsSchema.parse(input);

    expect(result.extraKnownMarketplaces).toHaveProperty('local');
    expect(result.enabledPlugins).toEqual({});
  });

  it('preserves unknown fields inside marketplace objects via passthrough', () => {
    const input = {
      extraKnownMarketplaces: {
        local: {
          source: {
            source: 'directory',
            path: '/Users/user/workspace/plugins',
          },
          unknownMarketplaceField: 'some-value',
        },
      },
    };

    const result = claudeSettingsSchema.parse(input);

    expect(result.extraKnownMarketplaces['local']).toEqual({
      source: {
        source: 'directory',
        path: '/Users/user/workspace/plugins',
      },
      unknownMarketplaceField: 'some-value',
    });
  });

  it('infers ClaudeSettings type correctly', () => {
    const settings: ClaudeSettings = {
      extraKnownMarketplaces: {
        local: {
          source: {
            source: 'directory',
            path: '/path/to/plugins',
          },
        },
      },
      enabledPlugins: {
        'plugin@local': true,
      },
    };

    expect(settings.extraKnownMarketplaces).toBeDefined();
    expect(settings.enabledPlugins).toBeDefined();
  });
});
