import { createTheme, type PaletteMode, type Theme } from '@mui/material/styles';

export function createAppTheme(mode: PaletteMode): Theme {
  const isDark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: { main: isDark ? '#7aa2ff' : '#2b5cff' },
      secondary: { main: isDark ? '#b88dff' : '#6f42c1' },
      error: { main: isDark ? '#ff6b6b' : '#d32f2f' },
      warning: { main: isDark ? '#ffb74d' : '#ed6c02' },
      success: { main: isDark ? '#5fd58a' : '#2e7d32' },
      background: {
        default: isDark ? '#0f1115' : '#fafbfc',
        paper: isDark ? '#161a22' : '#ffffff',
      },
      divider: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
      text: {
        primary: isDark ? '#e6e8ee' : '#1a1d24',
        secondary: isDark ? '#9aa3b2' : '#5a6573',
      },
    },
    shape: {
      borderRadius: 8,
    },
    typography: {
      fontFamily:
        '"Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      h1: { fontWeight: 600, letterSpacing: '-0.02em' },
      h2: { fontWeight: 600, letterSpacing: '-0.02em' },
      h3: { fontWeight: 600, letterSpacing: '-0.01em' },
      h4: { fontWeight: 600, letterSpacing: '-0.01em', fontSize: '1.6rem' },
      h5: { fontWeight: 600 },
      h6: { fontWeight: 600, fontSize: '1.05rem' },
      button: { textTransform: 'none', fontWeight: 500 },
    },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: { root: { borderRadius: 8 } },
      },
      MuiTextField: {
        defaultProps: { size: 'small' },
      },
      MuiToolbar: {
        styleOverrides: {
          root: { minHeight: 56 },
        },
      },
      MuiTab: {
        styleOverrides: { root: { textTransform: 'none', fontWeight: 500 } },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
        },
      },
    },
  });
}

export const theme = createAppTheme('light');
