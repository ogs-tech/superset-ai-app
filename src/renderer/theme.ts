import { createTheme, type PaletteMode, type Theme } from '@mui/material/styles';
import type { ThemeMode } from '../shared/settings.js';
import {
  ogs,
  colorRoles,
  surfaces,
  text,
  divider,
  radius,
  shadow,
  fonts,
} from './tokens.js';

declare module '@mui/material/styles' {
  interface Theme {
    ogs: {
      surfaces: { canvas: string; paper: string; rail: string; input: string };
      slate: string;
      radius: typeof radius;
      shadow: typeof shadow;
      fonts: typeof fonts;
    };
  }
  interface ThemeOptions {
    ogs?: Theme['ogs'];
  }
}

/** Resolve the persisted setting + OS preference into a concrete MUI mode. */
export function resolveThemeMode(setting: ThemeMode, prefersDark: boolean): PaletteMode {
  if (setting === 'system') return prefersDark ? 'dark' : 'light';
  return setting;
}

export function createAppTheme(mode: PaletteMode): Theme {
  const isDark = mode === 'dark';
  const roles = isDark ? colorRoles.dark : colorRoles.light;
  const surf = isDark ? surfaces.dark : surfaces.light;
  const txt = isDark ? text.dark : text.light;

  return createTheme({
    palette: {
      mode,
      // Ink is the neutral accent. Azul (secondary) is the default Button colour
      // — see MuiButton.defaultProps below.
      primary: {
        main: isDark ? ogs.creamInk : ogs.ink,
        contrastText: isDark ? ogs.ink : ogs.cream,
      },
      // Azul = action/link. Exposed as info AND secondary (convenience alias).
      info: { main: roles.azul },
      secondary: { main: roles.azul },
      success: { main: roles.verde },
      warning: { main: roles.ambar },
      error: { main: roles.erro },
      background: { default: surf.canvas, paper: surf.paper },
      divider: isDark ? divider.dark : divider.light,
      text: { primary: txt.primary, secondary: txt.secondary },
    },
    ogs: {
      surfaces: surf,
      slate: roles.slate,
      radius,
      shadow,
      fonts,
    },
    shape: { borderRadius: radius.md },
    typography: {
      fontFamily: fonts.sans,
      h1: { fontWeight: 600, letterSpacing: '-0.02em', fontSize: '2.625rem' }, // 42
      h2: { fontWeight: 600, letterSpacing: '-0.02em', fontSize: '2rem' }, // 32
      h3: { fontWeight: 600, letterSpacing: '-0.01em', fontSize: '1.25rem' }, // 20
      h4: { fontWeight: 600, letterSpacing: '-0.02em', fontSize: '1.625rem' }, // 26
      h5: { fontWeight: 600 },
      h6: { fontWeight: 600, fontSize: '1rem' },
      body1: { fontSize: '1rem' },
      body2: { fontSize: '0.875rem' },
      button: { textTransform: 'none', fontWeight: 500 },
    },
    components: {
      MuiButton: {
        // Azul (secondary) is the default Button color across the app — the
        // brand action colour. Buttons that need another role set `color`
        // explicitly (e.g. `inherit` in TopNav, `error` for destructive).
        defaultProps: { disableElevation: true, color: 'secondary' },
        styleOverrides: { root: { borderRadius: radius.sm } },
      },
      MuiTextField: { defaultProps: { size: 'small' } },
      MuiToolbar: { styleOverrides: { root: { minHeight: 56 } } },
      MuiTab: {
        styleOverrides: { root: { textTransform: 'none', fontWeight: 500 } },
      },
      // "Fio antes de sombra": outlined surfaces, hairline border, no shadow.
      MuiPaper: {
        defaultProps: { variant: 'outlined' },
        styleOverrides: {
          root: { backgroundImage: 'none' },
          outlined: ({ theme }) => ({ borderColor: theme.palette.divider }),
        },
      },
    },
  });
}

export const theme = createAppTheme('light');
