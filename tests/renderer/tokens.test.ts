import { describe, it, expect } from 'vitest';
import { ogs, colorRoles, surfaces, radius, fonts } from '../../src/renderer/tokens.js';

describe('OGS tokens', () => {
  it('pins the core ink/cream values', () => {
    expect(ogs.ink).toBe('#142036');
    expect(ogs.cream).toBe('#F7F4EE');
  });

  it('exposes light and dark chromatic roles', () => {
    expect(colorRoles.light.azul).toBe('#3D5CC2');
    expect(colorRoles.dark.azul).toBe('#5B79E0');
    expect(colorRoles.light.verde).toBe('#119350');
    expect(colorRoles.light.ambar).toBe('#D9A12C');
    expect(colorRoles.light.erro).toBe('#C0392B');
  });

  it('exposes surface tokens outside the palette', () => {
    expect(surfaces.light.rail).toBe('#F2EEE5');
    expect(surfaces.dark.canvas).toBe('#0F1828');
  });

  it('uses 14 as the default radius and Space Grotesk as the sans stack', () => {
    expect(radius.md).toBe(14);
    expect(fonts.sans).toContain('Space Grotesk');
    expect(fonts.mono).toContain('JetBrains Mono');
  });
});
