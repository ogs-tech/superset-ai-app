import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { CssBaseline, ThemeProvider, type PaletteMode } from '@mui/material';
import { callIpc } from './ipc.js';
import { createAppTheme, resolveThemeMode } from '../theme.js';
import type { Settings, ThemeMode } from '../../shared/settings.js';

interface ThemeModeContextValue {
  setting: ThemeMode;
  resolved: PaletteMode;
  setTheme: (next: ThemeMode) => void;
}

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

export function useThemeMode(): ThemeModeContextValue {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) throw new Error('useThemeMode must be used within ThemeModeProvider');
  return ctx;
}

function osPrefersDark(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    );
  } catch {
    return false;
  }
}

export function ThemeModeProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [setting, setSetting] = useState<ThemeMode>('system');
  const [systemDark, setSystemDark] = useState<boolean>(osPrefersDark);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const s = await callIpc<Settings | null>('settings.get', {});
        if (active && s) setSetting(s.ui.theme);
      } catch {
        // Keep the 'system' default if settings cannot be read.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent): void => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const resolved = resolveThemeMode(setting, systemDark);
  const theme = useMemo(() => createAppTheme(resolved), [resolved]);

  const value = useMemo<ThemeModeContextValue>(
    () => ({
      setting,
      resolved,
      setTheme: (next: ThemeMode): void => {
        setSetting(next);
        void callIpc('settings.merge', { ui: { theme: next } });
      },
    }),
    [setting, resolved],
  );

  return (
    <ThemeModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}
