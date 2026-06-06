import { describe, it, expect } from 'vitest';
import { createAppTheme, resolveThemeMode } from '../../src/renderer/theme.js';

describe('resolveThemeMode', () => {
  it('maps "system" to the OS preference', () => {
    expect(resolveThemeMode('system', true)).toBe('dark');
    expect(resolveThemeMode('system', false)).toBe('light');
  });
  it('honours an explicit setting regardless of OS', () => {
    expect(resolveThemeMode('dark', false)).toBe('dark');
    expect(resolveThemeMode('light', true)).toBe('light');
  });
});

describe('createAppTheme — OGS mapping', () => {
  it('uses Ink as the primary (filled-button) colour in light mode', () => {
    const t = createAppTheme('light');
    expect(t.palette.primary.main).toBe('#142036');
    expect(t.palette.primary.contrastText).toBe('#F7F4EE');
  });
  it('uses Azul for info/secondary (action accent)', () => {
    const t = createAppTheme('light');
    expect(t.palette.info.main).toBe('#3D5CC2');
    expect(t.palette.secondary.main).toBe('#3D5CC2');
  });
  it('inverts primary to Cream-ink in dark mode and sets the dark canvas', () => {
    const t = createAppTheme('dark');
    expect(t.palette.primary.main).toBe('#F2EEE5');
    expect(t.palette.background.default).toBe('#0F1828');
    expect(t.palette.primary.contrastText).toBe('#142036');
  });
  it('exposes OGS custom theme fields', () => {
    const t = createAppTheme('light');
    expect(t.ogs.surfaces.rail).toBe('#F2EEE5');
    expect(t.ogs.fonts.mono).toContain('JetBrains Mono');
    expect(t.ogs.radius.md).toBe(14);
  });
  it('sets Space Grotesk as the body font and 14px base radius', () => {
    const t = createAppTheme('light');
    expect(t.typography.fontFamily).toContain('Space Grotesk');
    expect(t.shape.borderRadius).toBe(14);
  });
});
