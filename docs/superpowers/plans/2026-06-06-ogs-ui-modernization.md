# OGS UI/UX Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `superset-ai-app` onto the OGS Design System — Cream/Ink palette, Space Grotesk + JetBrains Mono, hairline surfaces, Lucide icons, a two-level navigation shell (TopNav + SubRail + ⌘K command palette), and standardized empty/loading/error states — delivered as one PR with seven green commits.

**Architecture:** Presentation-layer refactor confined to `src/renderer/**` plus one main-process naming fix (`plugin-cache-file.ts`). The design system is applied *via* the MUI theme + a new `components/ds/*` layer, not by replacing MUI/Emotion/react-query. Navigation stays state-driven (no `react-router`): a `Nav` discriminated union replaces the single `SidebarTab`. Theme mode is wired to the existing `settings.ui.theme` through the existing `settings.merge` IPC (no new IPC).

**Tech Stack:** Electron + React 19 + MUI 9 + Emotion + @tanstack/react-query + Vitest (node + jsdom projects) + Playwright. New deps: `@fontsource/space-grotesk`, `@fontsource/jetbrains-mono`, `lucide-react`. Removed deps: `@fontsource/roboto`, `@mui/icons-material`.

---

## How to use this plan

- **Phases map 1:1 to the seven commits in spec §14.** Each phase ends green on `npm run lint && npm run typecheck && npm test`. The e2e gate (`npm run test:e2e`) is run at Phase 7.
- **TDD where it fits.** Logic and contracts (theme resolution, nav model, StatusPill variants, copy strings, testids) are driven by tests. Pure visual `sx` polish is *not* unit-tested — those steps carry an explicit **Manual QA** note instead of a failing-test step, per the project's "TDD where it fits, skip it where it doesn't" rule.
- **Run a single test file** with `npx vitest run <path>`; the whole suite with `npm test`.
- **Imports use `.js` extensions** on relative paths (ESM + `verbatimModuleSyntax`). Strict TS is on (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
- Commit messages use Conventional Commits and end with the `Co-Authored-By` trailer.

## Decisions locked before planning (spec §13)

1. **Error red:** use proposed `#C0392B` (light) / `#E2675A` (dark). Flagged "confirm with brand" — values are inline in `tokens.ts`; changing them later is a one-line edit.
2. **`SDE-AI` in `plugin-cache-file.ts`:** **included** in this PR (Phase 6, Task 6.3) — touches `src/main/**` and its one test. (User decision.)
3. **Command Palette scope:** navigation + creation actions only. In-list filtering (the `EntityDataGrid` search box) stays; the palette is *additive* global jump/create, not a replacement for in-list search.

---

## File Structure

### New files

| Path | Responsibility |
|---|---|
| `src/renderer/tokens.ts` | Raw OGS values: chromatic roles (light/dark), surfaces, radius, shadow, font stacks. No MUI dependency. |
| `src/renderer/theme.ts` *(rewritten)* | Builds the MUI theme from `tokens.ts`; module augmentation for `theme.ogs`; exports `resolveThemeMode`. |
| `src/renderer/lib/theme-mode-context.tsx` | `ThemeModeProvider` (reads `settings.ui.theme`, tracks OS preference, renders `ThemeProvider`+`CssBaseline`) and `useThemeMode()`. |
| `src/renderer/components/ds/Kicker.tsx` | Mono uppercase micro-label (tracking .20em, slate). |
| `src/renderer/components/ds/ScreenHeader.tsx` | Kicker + H1 + subtitle/count + actions slot. Used by every screen. |
| `src/renderer/components/ds/StatusPill.tsx` | Dot + mono label; variants `synced`/`unsynced`/`plugin`/`error`/`ok`/`warning`. Replaces `PluginOriginBadge`. |
| `src/renderer/components/ds/EmptyState.tsx` | Lucide icon + title + description + CTA slot. |
| `src/renderer/components/ds/LoadingState.tsx` | Skeleton variants (`list`/`card`/`detail`). |
| `src/renderer/components/ds/ErrorState.tsx` | Left-bar alert + "Tentar novamente". |
| `src/renderer/components/ds/Icon.tsx` | Lucide wrapper standardizing size (18) + `strokeWidth={1.75}` + `currentColor`. |
| `src/renderer/components/ds/index.ts` | Barrel for the `ds/*` layer. |
| `src/renderer/components/shell/nav.ts` | `Nav` discriminated union, area/sub types, `NAV_AREAS` + `LIBRARY_SUBS` + `PLUGINS_SUBS` registries, `navTestId` helper. |
| `src/renderer/components/shell/TopNav.tsx` | Brand, primary tabs, ⌘K trigger, sync `StatusPill`, theme toggle, settings gear. |
| `src/renderer/components/shell/SubRail.tsx` | Contextual sub-navigation for `biblioteca`/`plugins`. |
| `src/renderer/components/shell/CommandPalette.tsx` | ⌘K overlay: filterable nav + create actions (MUI `Dialog`). |
| `src/renderer/components/shell/AppShell.tsx` | Owns `Nav` state; lays out TopNav + SubRail + screen; renders CommandPalette. |
| `src/renderer/assets/Logo.tsx` | Inline OGS brand mark (SVG component) for the TopNav. |
| `tests/renderer/theme.test.ts` | `resolveThemeMode` + key palette mappings. |
| `tests/renderer/lib/theme-mode-context.test.tsx` | Reads setting, toggles, persists via `settings.merge`. |
| `tests/renderer/components/ds/Kicker.test.tsx` | … |
| `tests/renderer/components/ds/StatusPill.test.tsx` | Variant → color/label/testid. |
| `tests/renderer/components/ds/ScreenHeader.test.tsx` | Renders kicker/title/actions. |
| `tests/renderer/components/ds/EmptyState.test.tsx`, `LoadingState.test.tsx`, `ErrorState.test.tsx`, `Icon.test.tsx` | Behavior of each state/wrapper. |
| `tests/renderer/components/shell/nav.test.ts` | Registry shape + helpers. |
| `tests/renderer/components/shell/TopNav.test.tsx` | Tabs, theme toggle, sync chip. |
| `tests/renderer/components/shell/SubRail.test.tsx` | Contextual items per area. |
| `tests/renderer/components/shell/CommandPalette.test.tsx` | Open via ⌘K, filter, select nav/create. |
| `tests/renderer/components/shell/AppShell.test.tsx` | Area/sub switching. |

### Modified files

| Path | Change |
|---|---|
| `package.json` | +`@fontsource/space-grotesk`, +`@fontsource/jetbrains-mono`, +`lucide-react`; −`@fontsource/roboto`, −`@mui/icons-material`. |
| `src/renderer/main.tsx` | Swap font CSS imports; wrap `App` in `ThemeModeProvider` (remove inline theme/CssBaseline). |
| `src/renderer/screens/Main.tsx` | Replace `Sidebar` with `AppShell` + `Nav` model. |
| **delete** `src/renderer/components/Sidebar.tsx` | Replaced by the shell. |
| 16 renderer files importing `@mui/icons-material` | Migrate to Lucide (Phase 3). |
| All `src/renderer/screens/**` + restyled `components/**` | Apply OGS (Phase 5). |
| `src/renderer/lib/default-global-instruction.ts` | SDE copy → OGS (Phase 6). |
| `src/main/infrastructure/plugins/plugin-cache-file.ts` | `SDE-AI` → `OGS` (Phase 6). |
| `tests/renderer/test-utils.tsx` | Add `renderWithShell` wrapping `ThemeModeProvider` + `QueryClientProvider`. |
| `tests/renderer/screens/main.test.tsx`, `main-health.test.tsx` | `sidebar-*` → `nav-*` testids; group test removed/replaced. |
| `tests/main/infrastructure/plugins/plugin-cache-file.test.ts` | `SDE-AI` → `OGS` assertions. |
| `e2e/language-gi-staleness.spec.ts` | Navigate via new shell. |

### Testid migration map (single source of truth)

| Old (Sidebar) | New (shell) | Used by |
|---|---|---|
| `sidebar` | `app-shell` (root) | main.test |
| `sidebar-settings` | `nav-settings` (TopNav gear) | main.test, e2e |
| `sidebar-skills` | `nav-skills` (SubRail) | main.test |
| `sidebar-agents` | `nav-agents` (SubRail) | main.test |
| `sidebar-global-instructions` | `nav-global-instructions` (SubRail) | e2e |
| `sidebar-diagnostics` | `nav-diagnostico` (TopNav tab) | main-health.test |
| `sidebar-health-badge` | `sync-status` (TopNav StatusPill, keeps `data-severity`) | main-health.test |
| `sidebar-group-customizations` | *(removed — no collapsible group in two-level shell)* | main.test (delete that test) |
| `main-screen` | `main-screen` *(unchanged — kept on shell root for e2e)* | e2e |

> **Rule:** every SubRail/TopNav nav item carries `data-testid={navTestId(area, sub)}` producing `nav-<id>` (e.g. `nav-skills`, `nav-global-instructions`, `nav-diagnostico`, `nav-inicio`, `nav-plugins`, `nav-marketplaces`, `nav-biblioteca`). TopNav settings gear is `nav-settings`. The ⌘K trigger is `command-palette-trigger`; the palette dialog is `command-palette`.

---

# Phase 1 — `feat(theme): OGS tokens, palette, typography, shape`

Tokens, theme rewrite, fonts, and `settings.ui.theme` wiring. Closes the existing gap where `main.tsx` ignored `settings.ui.theme`.

### Task 1.1: Swap font + icon dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install new deps, remove old**

Run:
```bash
npm install @fontsource/space-grotesk @fontsource/jetbrains-mono lucide-react
npm uninstall @fontsource/roboto
```
(`@mui/icons-material` is removed in Phase 4, after `Sidebar.tsx` — its last consumer — is deleted.)

- [ ] **Step 2: Verify install**

Run: `npm run typecheck`
Expected: PASS (no source references the new packages yet; Roboto removal does not break typecheck because its imports live in `main.tsx`, fixed in Task 1.4 — if you run between tasks, expect a Vite/runtime-only error, not a tsc error).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(theme): swap roboto for space-grotesk + jetbrains-mono, add lucide" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 1.2: Create `tokens.ts`

**Files:**
- Create: `src/renderer/tokens.ts`
- Test: `tests/renderer/tokens.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/renderer/tokens.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/renderer/tokens.test.ts`
Expected: FAIL — "Failed to resolve import '../../src/renderer/tokens.js'".

- [ ] **Step 3: Write the implementation**

```ts
// src/renderer/tokens.ts
// OGS Design System v1.0 (2026) — raw brand tokens. Consumed by theme.ts.
// "Cream is the paper, Ink is the stroke." One chromatic role at a time:
// azul = action/link, verde = success/active, ambar = premium/attention,
// erro = error. Ink is the neutral accent (and the default filled button).

export const ogs = {
  ink: '#142036',
  cream: '#F7F4EE',
  /** Cream tint used for ink-on-dark text and dark-mode filled-button text. */
  creamInk: '#F2EEE5',
} as const;

export const colorRoles = {
  light: {
    azul: '#3D5CC2',
    verde: '#119350',
    ambar: '#D9A12C',
    erro: '#C0392B', // §13: confirm with brand
    slate: '#7A7E89',
  },
  dark: {
    azul: '#5B79E0',
    verde: '#3FB97A',
    ambar: '#E5B547',
    erro: '#E2675A',
    slate: '#9AA0A8',
  },
} as const;

/** Surface tokens that have no MUI palette slot. */
export const surfaces = {
  light: { canvas: '#F7F4EE', paper: '#FFFFFF', rail: '#F2EEE5', input: '#FBFAF6' },
  dark: { canvas: '#0F1828', paper: '#16223A', rail: '#142036', input: '#16223A' },
} as const;

export const text = {
  light: { primary: '#142036', secondary: '#5A6573' },
  dark: { primary: '#F2EEE5', secondary: '#9AA0A8' },
} as const;

export const divider = {
  light: 'rgba(20,32,54,0.11)',
  dark: 'rgba(255,255,255,0.08)',
} as const;

export const radius = { xs: 6, sm: 10, md: 14, lg: 20, pill: 999 } as const;

export const shadow = {
  sm: '0 1px 2px rgba(20,32,54,0.06), 0 1px 3px rgba(20,32,54,0.10)',
  md: '0 4px 12px rgba(20,32,54,0.12)',
  lg: '0 12px 32px rgba(20,32,54,0.18)',
} as const;

export const fonts = {
  sans: '"Space Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
} as const;

export type ThemeColorRole = keyof typeof colorRoles.light;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/renderer/tokens.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/tokens.ts tests/renderer/tokens.test.ts
git commit -m "feat(theme): add OGS raw design tokens" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 1.3: Rewrite `theme.ts` from tokens + `resolveThemeMode`

**Files:**
- Modify: `src/renderer/theme.ts` (full rewrite of `src/renderer/theme.ts:1-64`)
- Test: `tests/renderer/theme.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/renderer/theme.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/renderer/theme.test.ts`
Expected: FAIL — `resolveThemeMode` not exported; `t.ogs` undefined.

- [ ] **Step 3: Write the implementation (full file rewrite)**

```ts
// src/renderer/theme.ts
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
      // Ink is the neutral accent and the default filled button (DS "Novo projeto").
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
        defaultProps: { disableElevation: true },
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
```

> **Note on `MuiPaper` default `variant: 'outlined'`:** this makes Dialogs/Menus/Drawers outlined by default. Those overlays *should* keep a shadow (spec §5). In Phase 5 the overlay components (`DetailDrawer`, `SyncReportModal`, dialogs, `CommandPalette`) pass `elevation`/explicit `sx` shadow where needed. If any overlay looks flat after Phase 1, that is expected and addressed in Phase 5 — do not "fix" it here.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/renderer/theme.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/theme.ts tests/renderer/theme.test.ts
git commit -m "feat(theme): rebuild MUI theme on OGS tokens (Ink primary, Azul action)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 1.4: Theme-mode context (reads + persists `settings.ui.theme`)

**Files:**
- Create: `src/renderer/lib/theme-mode-context.tsx`
- Test: `tests/renderer/lib/theme-mode-context.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/renderer/lib/theme-mode-context.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeModeProvider, useThemeMode } from '../../../src/renderer/lib/theme-mode-context.js';
import { mockApi, ok, type CallSpy } from '../test-utils.js';

let call: CallSpy;
beforeEach(() => {
  call = mockApi();
});

function Probe(): React.ReactElement {
  const { setting, setTheme } = useThemeMode();
  return (
    <div>
      <span data-testid="setting">{setting}</span>
      <button onClick={() => setTheme('dark')}>go dark</button>
    </div>
  );
}

describe('ThemeModeProvider', () => {
  it('reads the persisted theme on mount', async () => {
    call.mockResolvedValue(ok({ ui: { theme: 'dark' }, adapters: { claude: { enabled: true } }, linkedRepos: [], language: 'off' }));
    render(<ThemeModeProvider><Probe /></ThemeModeProvider>);
    await waitFor(() => expect(screen.getByTestId('setting')).toHaveTextContent('dark'));
  });

  it('persists a toggle via settings.merge', async () => {
    call.mockResolvedValue(ok({ ui: { theme: 'system' }, adapters: { claude: { enabled: true } }, linkedRepos: [], language: 'off' }));
    render(<ThemeModeProvider><Probe /></ThemeModeProvider>);
    await userEvent.click(screen.getByRole('button', { name: 'go dark' }));
    expect(call).toHaveBeenCalledWith('settings.merge', { ui: { theme: 'dark' } });
    expect(screen.getByTestId('setting')).toHaveTextContent('dark');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/renderer/lib/theme-mode-context.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```tsx
// src/renderer/lib/theme-mode-context.tsx
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
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/renderer/lib/theme-mode-context.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/lib/theme-mode-context.tsx tests/renderer/lib/theme-mode-context.test.tsx
git commit -m "feat(theme): wire settings.ui.theme via ThemeModeProvider" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 1.5: Swap fonts + providers in `main.tsx`

**Files:**
- Modify: `src/renderer/main.tsx` (full rewrite of `src/renderer/main.tsx:1-43`)

- [ ] **Step 1: Rewrite `main.tsx`**

```tsx
// src/renderer/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/600.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import { App } from './App.js';
import { ThemeModeProvider } from './lib/theme-mode-context.js';

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

createRoot(root).render(
  <StrictMode>
    <ThemeModeProvider>
      <App />
    </ThemeModeProvider>
  </StrictMode>,
);
```

- [ ] **Step 2: Verify nothing else imports Roboto**

Run: `grep -rn "fontsource/roboto" src tests` 
Expected: no output (zero matches).

- [ ] **Step 3: Run the full suite + typecheck + lint**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS. (`bootstrap-router.test.tsx` renders `<App/>` directly — MUI falls back to its default theme without `ThemeModeProvider`, so it stays green.)

- [ ] **Step 4: Smoke-test the dev app (Manual QA)**

Run: `npm run dev`
Expected: App boots in Cream/Ink with Space Grotesk; toggling OS dark mode flips canvas to `#0F1828`. (Full theme toggle UI lands in Phase 4.)

- [ ] **Step 5: Commit**

```bash
git add src/renderer/main.tsx
git commit -m "feat(theme): load OGS fonts and ThemeModeProvider in renderer entry" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

**Phase 1 gate:** `npm run lint && npm run typecheck && npm test` green.

---

# Phase 2 — `feat(ds): shared design-system components`

The reusable OGS layer. Each component is independently tested. These live in `components/ds/**` (not in the coverage `include` list, so they don't move thresholds — but we test them anyway).

### Task 2.1: `Kicker`

**Files:**
- Create: `src/renderer/components/ds/Kicker.tsx`
- Test: `tests/renderer/components/ds/Kicker.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/renderer/components/ds/Kicker.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Kicker } from '../../../../src/renderer/components/ds/Kicker.js';

describe('Kicker', () => {
  it('renders its label in a mono uppercase micro-label', () => {
    render(<Kicker>Biblioteca</Kicker>);
    const el = screen.getByText('Biblioteca');
    expect(el).toBeInTheDocument();
    expect(el).toHaveStyle({ textTransform: 'uppercase' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/renderer/components/ds/Kicker.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```tsx
// src/renderer/components/ds/Kicker.tsx
import { Typography, type TypographyProps } from '@mui/material';
import type { ReactNode } from 'react';

interface KickerProps {
  children: ReactNode;
  component?: TypographyProps['component'];
}

export function Kicker({ children, component = 'span' }: KickerProps): React.ReactElement {
  return (
    <Typography
      component={component}
      sx={(theme) => ({
        fontFamily: theme.ogs.fonts.mono,
        fontSize: '0.6875rem', // 11px
        fontWeight: 500,
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        color: theme.ogs.slate,
        lineHeight: 1.4,
      })}
    >
      {children}
    </Typography>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/renderer/components/ds/Kicker.test.tsx`
Expected: PASS.

> **Note:** because `Kicker` reads `theme.ogs`, the test renders without a ThemeProvider — MUI's *default* theme has no `ogs` field, so `theme.ogs.fonts.mono` would throw. **Wrap the render in the OGS theme.** Update Step 1's test to wrap: `render(<ThemeProvider theme={createAppTheme('light')}><Kicker>…</Kicker></ThemeProvider>)`, importing both from the renderer. Apply this wrapper to every `ds/*` test whose component reads `theme.ogs` (Kicker, StatusPill, ScreenHeader, EmptyState, LoadingState, ErrorState).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/ds/Kicker.tsx tests/renderer/components/ds/Kicker.test.tsx
git commit -m "feat(ds): add Kicker micro-label" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2.2: `StatusPill`

**Files:**
- Create: `src/renderer/components/ds/StatusPill.tsx`
- Test: `tests/renderer/components/ds/StatusPill.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/renderer/components/ds/StatusPill.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { createAppTheme } from '../../../../src/renderer/theme.js';
import { StatusPill } from '../../../../src/renderer/components/ds/StatusPill.js';

const wrap = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={createAppTheme('light')}>{ui}</ThemeProvider>);

describe('StatusPill', () => {
  it('renders the provided label', () => {
    wrap(<StatusPill variant="synced" label="synced" />);
    expect(screen.getByText('synced')).toBeInTheDocument();
  });

  it('exposes the variant for testing and styling', () => {
    wrap(<StatusPill variant="plugin" label="my-plugin" testId="origin" />);
    const pill = screen.getByTestId('status-pill-origin');
    expect(pill).toHaveAttribute('data-variant', 'plugin');
  });

  it('defaults the label from the variant when none is given', () => {
    wrap(<StatusPill variant="unsynced" />);
    expect(screen.getByText('unsynced')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/renderer/components/ds/StatusPill.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```tsx
// src/renderer/components/ds/StatusPill.tsx
import { Box, Typography, type Theme } from '@mui/material';

export type StatusPillVariant =
  | 'synced'
  | 'unsynced'
  | 'plugin'
  | 'error'
  | 'ok'
  | 'warning';

interface StatusPillProps {
  variant: StatusPillVariant;
  label?: string;
  testId?: string;
}

function color(theme: Theme, variant: StatusPillVariant): string {
  switch (variant) {
    case 'synced':
    case 'ok':
      return theme.palette.success.main;
    case 'unsynced':
    case 'warning':
      return theme.palette.warning.main;
    case 'plugin':
      return theme.palette.info.main;
    case 'error':
      return theme.palette.error.main;
  }
}

export function StatusPill({ variant, label, testId }: StatusPillProps): React.ReactElement {
  return (
    <Box
      {...(testId ? { 'data-testid': `status-pill-${testId}` } : {})}
      data-variant={variant}
      sx={(theme) => ({
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1,
        py: 0.25,
        borderRadius: theme.ogs.radius.pill,
        border: `1px solid ${color(theme, variant)}`,
        color: color(theme, variant),
        bgcolor: 'transparent',
      })}
    >
      <Box
        component="span"
        sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'currentColor' }}
      />
      <Typography
        component="span"
        sx={(theme) => ({
          fontFamily: theme.ogs.fonts.mono,
          fontSize: '0.6875rem',
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'inherit',
        })}
      >
        {label ?? variant}
      </Typography>
    </Box>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/renderer/components/ds/StatusPill.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/ds/StatusPill.tsx tests/renderer/components/ds/StatusPill.test.tsx
git commit -m "feat(ds): add StatusPill (synced/unsynced/plugin/error)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2.3: `ScreenHeader`

**Files:**
- Create: `src/renderer/components/ds/ScreenHeader.tsx`
- Test: `tests/renderer/components/ds/ScreenHeader.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/renderer/components/ds/ScreenHeader.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { createAppTheme } from '../../../../src/renderer/theme.js';
import { ScreenHeader } from '../../../../src/renderer/components/ds/ScreenHeader.js';

const wrap = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={createAppTheme('light')}>{ui}</ThemeProvider>);

describe('ScreenHeader', () => {
  it('renders kicker, title (h1) and subtitle', () => {
    wrap(<ScreenHeader kicker="Biblioteca" title="Skills" subtitle="12 pessoais" />);
    expect(screen.getByText('Biblioteca')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Skills' })).toBeInTheDocument();
    expect(screen.getByText('12 pessoais')).toBeInTheDocument();
  });

  it('renders an actions slot', () => {
    wrap(<ScreenHeader title="Skills" actions={<button>Nova skill</button>} />);
    expect(screen.getByRole('button', { name: 'Nova skill' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/renderer/components/ds/ScreenHeader.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```tsx
// src/renderer/components/ds/ScreenHeader.tsx
import { Box, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { Kicker } from './Kicker.js';

interface ScreenHeaderProps {
  title: ReactNode;
  kicker?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}

export function ScreenHeader({
  title,
  kicker,
  subtitle,
  actions,
}: ScreenHeaderProps): React.ReactElement {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-start', sm: 'flex-end' }}
      gap={2}
      sx={{ mb: 3 }}
    >
      <Box sx={{ minWidth: 0 }}>
        {kicker !== undefined && <Kicker>{kicker}</Kicker>}
        <Typography variant="h4" component="h1" sx={{ mt: kicker !== undefined ? 0.5 : 0 }}>
          {title}
        </Typography>
        {subtitle !== undefined && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {actions !== undefined && (
        <Stack direction="row" gap={1} alignItems="center" sx={{ flexShrink: 0 }}>
          {actions}
        </Stack>
      )}
    </Stack>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/renderer/components/ds/ScreenHeader.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/ds/ScreenHeader.tsx tests/renderer/components/ds/ScreenHeader.test.tsx
git commit -m "feat(ds): add ScreenHeader" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2.4: `Icon` (Lucide wrapper)

**Files:**
- Create: `src/renderer/components/ds/Icon.tsx`
- Test: `tests/renderer/components/ds/Icon.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/renderer/components/ds/Icon.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { House } from 'lucide-react';
import { Icon } from '../../../../src/renderer/components/ds/Icon.js';

describe('Icon', () => {
  it('renders the given Lucide glyph with default stroke + size', () => {
    const { container } = render(<Icon glyph={House} aria-label="início" />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('width', '18');
    expect(svg).toHaveAttribute('stroke-width', '1.75');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/renderer/components/ds/Icon.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```tsx
// src/renderer/components/ds/Icon.tsx
import type { LucideIcon, LucideProps } from 'lucide-react';

interface IconProps extends Omit<LucideProps, 'ref'> {
  glyph: LucideIcon;
  size?: number;
}

/** Standardizes Lucide size (18) and stroke (1.75); colour inherits currentColor. */
export function Icon({ glyph: Glyph, size = 18, ...rest }: IconProps): React.ReactElement {
  return <Glyph size={size} strokeWidth={1.75} {...rest} />;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/renderer/components/ds/Icon.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/ds/Icon.tsx tests/renderer/components/ds/Icon.test.tsx
git commit -m "feat(ds): add Lucide Icon wrapper" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2.5: `EmptyState`, `LoadingState`, `ErrorState`

**Files:**
- Create: `src/renderer/components/ds/EmptyState.tsx`, `LoadingState.tsx`, `ErrorState.tsx`
- Test: `tests/renderer/components/ds/EmptyState.test.tsx`, `LoadingState.test.tsx`, `ErrorState.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// tests/renderer/components/ds/EmptyState.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { Sparkles } from 'lucide-react';
import { createAppTheme } from '../../../../src/renderer/theme.js';
import { EmptyState } from '../../../../src/renderer/components/ds/EmptyState.js';

const wrap = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={createAppTheme('light')}>{ui}</ThemeProvider>);

describe('EmptyState', () => {
  it('renders title, description and CTA', () => {
    wrap(
      <EmptyState
        glyph={Sparkles}
        title="Nenhuma skill ainda"
        description="Crie a primeira."
        cta={<button>Criar skill</button>}
        testId="skill"
      />,
    );
    expect(screen.getByTestId('empty-state-skill')).toBeInTheDocument();
    expect(screen.getByText('Nenhuma skill ainda')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar skill' })).toBeInTheDocument();
  });
});
```

```tsx
// tests/renderer/components/ds/LoadingState.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { createAppTheme } from '../../../../src/renderer/theme.js';
import { LoadingState } from '../../../../src/renderer/components/ds/LoadingState.js';

describe('LoadingState', () => {
  it('renders skeletons for the requested kind', () => {
    render(
      <ThemeProvider theme={createAppTheme('light')}>
        <LoadingState kind="list" testId="skill" />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('loading-state-skill')).toBeInTheDocument();
  });
});
```

```tsx
// tests/renderer/components/ds/ErrorState.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material';
import { createAppTheme } from '../../../../src/renderer/theme.js';
import { ErrorState } from '../../../../src/renderer/components/ds/ErrorState.js';

describe('ErrorState', () => {
  it('shows the message and retries on click', async () => {
    const onRetry = vi.fn();
    render(
      <ThemeProvider theme={createAppTheme('light')}>
        <ErrorState message="Falha ao carregar" onRetry={onRetry} testId="skill" />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('error-state-skill')).toHaveTextContent('Falha ao carregar');
    await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/renderer/components/ds/EmptyState.test.tsx tests/renderer/components/ds/LoadingState.test.tsx tests/renderer/components/ds/ErrorState.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write the implementations**

```tsx
// src/renderer/components/ds/EmptyState.tsx
import { Box, Stack, Typography } from '@mui/material';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Icon } from './Icon.js';

interface EmptyStateProps {
  glyph: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  cta?: ReactNode;
  testId?: string;
}

export function EmptyState({
  glyph,
  title,
  description,
  cta,
  testId,
}: EmptyStateProps): React.ReactElement {
  return (
    <Stack
      {...(testId ? { 'data-testid': `empty-state-${testId}` } : {})}
      alignItems="center"
      justifyContent="center"
      gap={1.5}
      sx={(theme) => ({
        textAlign: 'center',
        py: 8,
        px: 3,
        border: `1px dashed ${theme.palette.divider}`,
        borderRadius: theme.ogs.radius.md,
        color: 'text.secondary',
      })}
    >
      <Box sx={{ color: 'text.secondary' }}>
        <Icon glyph={glyph} size={28} aria-hidden />
      </Box>
      <Typography variant="h6" color="text.primary">
        {title}
      </Typography>
      {description !== undefined && (
        <Typography variant="body2" sx={{ maxWidth: 420 }}>
          {description}
        </Typography>
      )}
      {cta !== undefined && <Box sx={{ mt: 1 }}>{cta}</Box>}
    </Stack>
  );
}
```

```tsx
// src/renderer/components/ds/LoadingState.tsx
import { Skeleton, Stack } from '@mui/material';

interface LoadingStateProps {
  kind: 'list' | 'card' | 'detail';
  testId?: string;
}

export function LoadingState({ kind, testId }: LoadingStateProps): React.ReactElement {
  const rows = kind === 'detail' ? 1 : 4;
  return (
    <Stack
      {...(testId ? { 'data-testid': `loading-state-${testId}` } : {})}
      gap={1.5}
      sx={{ py: 2 }}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton
          key={i}
          variant="rounded"
          height={kind === 'detail' ? 240 : 64}
          sx={(theme) => ({ borderRadius: theme.ogs.radius.md })}
        />
      ))}
    </Stack>
  );
}
```

```tsx
// src/renderer/components/ds/ErrorState.tsx
import { Alert, AlertTitle, Button } from '@mui/material';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  testId?: string;
}

export function ErrorState({ message, onRetry, testId }: ErrorStateProps): React.ReactElement {
  return (
    <Alert
      {...(testId ? { 'data-testid': `error-state-${testId}` } : {})}
      severity="error"
      variant="outlined"
      sx={(theme) => ({ borderLeft: `4px solid ${theme.palette.error.main}` })}
      action={
        onRetry !== undefined ? (
          <Button color="inherit" size="small" onClick={onRetry}>
            Tentar novamente
          </Button>
        ) : undefined
      }
    >
      <AlertTitle>Erro</AlertTitle>
      {message}
    </Alert>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/renderer/components/ds/`
Expected: PASS (all ds tests).

- [ ] **Step 5: Create the barrel + commit**

```ts
// src/renderer/components/ds/index.ts
export { Kicker } from './Kicker.js';
export { ScreenHeader } from './ScreenHeader.js';
export { StatusPill, type StatusPillVariant } from './StatusPill.js';
export { EmptyState } from './EmptyState.js';
export { LoadingState } from './LoadingState.js';
export { ErrorState } from './ErrorState.js';
export { Icon } from './Icon.js';
```

```bash
git add src/renderer/components/ds tests/renderer/components/ds
git commit -m "feat(ds): add EmptyState/LoadingState/ErrorState + barrel" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

**Phase 2 gate:** `npm run lint && npm run typecheck && npm test` green.

---

# Phase 3 — `refactor(icons): migrate @mui/icons-material → lucide-react`

Migrate the **16 non-Sidebar files**. `Sidebar.tsx` keeps its MUI icons (it is deleted in Phase 4, which also removes the `@mui/icons-material` dependency). This phase changes no copy and no testids, so **no test changes** are expected — the gate is typecheck + existing tests staying green.

> **Lucide naming caveat:** the target names below are the intended glyphs. `lucide-react` occasionally renames exports between versions. `npm run typecheck` will fail on a non-existent named import — if it does, open the installed `lucide-react` types and pick the current name for that glyph (e.g. `CheckCircle2` may be `CircleCheckBig`; `MoreVertical` may be `EllipsisVertical`). Record any substitution inline.

### Icon replacement map (all glyphs actually used in the renderer)

| MUI import | Lucide import | MUI import | Lucide import |
|---|---|---|---|
| `Add` | `Plus` | `Home` | `House` |
| `ArrowBack` | `ArrowLeft` | `Hub` | `Network` |
| `ArrowForward` | `ArrowRight` | `InfoOutlined` | `Info` |
| `AutoAwesome` | `Sparkles` | `Language` | `Languages` |
| `AutoFixHigh` | `WandSparkles` | `LinkOff` | `Unlink` |
| `BoltRounded` | `Zap` | `MonitorHeart` | `Activity` |
| `CheckCircle` | `CheckCircle2` | `MoreVert` | `MoreVertical` |
| `ChevronLeft` | `ChevronLeft` | `NotesRounded` | `FileText` |
| `ChevronRight` | `ChevronRight` | `Power` | `Power` |
| `Close` | `X` | `PublicRounded` | `Globe` |
| `ContentCopy` | `Copy` | `Refresh` | `RefreshCw` |
| `DataObject` | `Braces` | `RocketLaunch` | `Rocket` |
| `DeleteOutlined` | `Trash2` | `Search` | `Search` |
| `Download` | `Download` | `Settings` | `Settings` |
| `Edit` | `Pencil` | `ShieldRounded` | `Shield` |
| `EditNote` | `NotebookPen` | `SmartToy` | `Bot` |
| `ErrorOutlined` | `CircleAlert` | `Storefront` | `Store` |
| `ExpandLess` | `ChevronUp` | `Terminal` | `SquareTerminal` |
| `ExpandMore` | `ChevronDown` | `Tune` | `SlidersHorizontal` |
| `Extension` | `Puzzle` | `Verified` | `BadgeCheck` |
| `ForumRounded` | `MessagesSquare` | `Webhook` | `Webhook` |
| `HandshakeRounded` | `Handshake` | | |

### Per-glyph usage equivalence

MUI usage → Lucide usage:
- `<XIcon fontSize="small" />` → `<Icon glyph={X} size={16} />` (small ≈ 16) or `<Icon glyph={X} />` (default 18). Use **16** wherever the original was `fontSize="small"`, **20** for standalone hero icons, default 18 otherwise.
- `<XIcon color="success" />` → `<Icon glyph={X} className="..." />` — Lucide has no MUI `color` prop. Wrap in a `<Box sx={{ color: 'success.main' }}>` or pass `style={{ color: theme.palette.success.main }}`. Simplest: wrap with `<Box component="span" sx={{ color: 'success.main', display: 'inline-flex' }}><Icon glyph={X} /></Box>`.
- `<XIcon sx={{ fontSize: 14 }} />` → `<Icon glyph={X} size={14} />`.
- `startIcon={<XIcon />}` on a `<Button>` → `startIcon={<Icon glyph={X} size={16} />}`.
- Icons stored in arrays/JSX nodes (e.g. `icon: <DeleteOutlineIcon fontSize="small" />`) → `icon: <Icon glyph={Trash2} size={16} />`.

### Task 3.1: Migrate `components/**`

**Files (modify):**
- `src/renderer/components/DetailDrawer.tsx` — `Close` → `X` (line 4 import, line 69 usage).
- `src/renderer/components/CustomizationViewDrawer.tsx` — `Edit` → `Pencil` (line 2, line 47).
- `src/renderer/components/CustomizationListScreen.tsx` — `Add`→`Plus`, `Edit`→`Pencil`, `DeleteOutlined`→`Trash2`, `ContentCopy`→`Copy` (lines 14-17; usages 156, 166, 176, 210, 234).
- `src/renderer/components/PluginOriginBadge.tsx` — `Extension` → `Puzzle` (line 2, line 15). *(This component is replaced by `StatusPill` in Phase 5; migrate the icon now so the phase stays green.)*
- `src/renderer/components/EntityViewer.tsx` — `ArrowBack` → `ArrowLeft` (line 9, line 41).
- `src/renderer/components/EntityDataGrid/Toolbar.tsx` — `Search` → `Search` (line 3, line 37-38, inside `InputAdornment`).

- [ ] **Step 1: Migrate each file**

For each file: replace the `import …Icon from '@mui/icons-material/…'` lines with `import { <Glyph> } from 'lucide-react';` and `import { Icon } from '../ds/Icon.js';` (adjust relative depth — `EntityDataGrid/Toolbar.tsx` uses `../ds/Icon.js`), then swap each JSX usage per the equivalence rules. Example for `DetailDrawer.tsx`:

```tsx
// before:
import CloseIcon from '@mui/icons-material/Close';
// …
<CloseIcon fontSize="small" />

// after:
import { X } from 'lucide-react';
import { Icon } from './ds/Icon.js';
// …
<Icon glyph={X} size={16} />
```

For `EntityDataGrid/Toolbar.tsx`, the `SearchIcon` sits in an `InputAdornment`:
```tsx
import { Search } from 'lucide-react';
import { Icon } from '../ds/Icon.js';
// …
<InputAdornment position="start">
  <Icon glyph={Search} size={16} />
</InputAdornment>
```

- [ ] **Step 2: Verify no MUI icon imports remain in `components/**`**

Run: `grep -rn "@mui/icons-material" src/renderer/components --include=*.tsx | grep -v Sidebar.tsx`
Expected: no output.

- [ ] **Step 3: Run typecheck + affected tests**

Run: `npm run typecheck && npx vitest run tests/renderer/components/`
Expected: PASS. (Tests query by accessible name/testid, not by icon — unaffected.)

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components
git commit -m "refactor(icons): migrate shared components to lucide-react" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 3.2: Migrate `screens/**`

**Files (modify):** `Settings.tsx` (ArrowBack→ArrowLeft, LinkOff→Unlink, Add→Plus, InfoOutlined→Info), `IoError.tsx` (ErrorOutlined→CircleAlert), `plugins/PluginList.tsx` (MoreVert→MoreVertical, Download→Download), `starter-pack/StarterPackScreen.tsx` (11 icons per map), `health/HealthScreen.tsx` (Refresh→RefreshCw, CheckCircle→CheckCircle2), `hooks/HookList.tsx` (DeleteOutlined→Trash2), `global-instructions/GlobalInstructionScreen.tsx` (9 icons per map), `marketplaces/PluginInstallPreviewDialog.tsx` (6 icons), `marketplaces/MarketplaceList.tsx` (Download, Refresh→RefreshCw, DeleteOutlined→Trash2, Verified→BadgeCheck), `marketplaces/MarketplaceDetail.tsx` (Verified→BadgeCheck).

- [ ] **Step 1: Migrate each file** using the map + equivalence rules. For `color="success"`/`color="error"` usages (e.g. `StarterPackScreen.tsx:609` `<CheckCircleIcon color="success" />`, `HealthScreen.tsx:97`, `IoError.tsx:15`), wrap:
```tsx
<Box component="span" sx={{ color: 'success.main', display: 'inline-flex' }}>
  <Icon glyph={CheckCircle2} size={16} />
</Box>
```

- [ ] **Step 2: Verify zero MUI icon imports remain outside Sidebar**

Run: `grep -rn "@mui/icons-material" src/renderer/screens`
Expected: no output.

- [ ] **Step 3: Run typecheck + full suite**

Run: `npm run typecheck && npm test`
Expected: PASS. If a Lucide name is wrong, typecheck fails — substitute per the caveat and re-run.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/screens
git commit -m "refactor(icons): migrate screens to lucide-react" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

**Phase 3 gate:** `npm run lint && npm run typecheck && npm test` green. (`Sidebar.tsx` still imports `@mui/icons-material`; dependency stays until Phase 4.)

---

# Phase 4 — `feat(shell): TopNav + SubRail + CommandPalette`

Replace `Sidebar` + `Main`'s single `SidebarTab` with the two-level shell and `Nav` model. Delete `Sidebar.tsx`, remove the `@mui/icons-material` dependency, update navigation tests.

### Task 4.1: Navigation model + registry

**Files:**
- Create: `src/renderer/components/shell/nav.ts`
- Test: `tests/renderer/components/shell/nav.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/renderer/components/shell/nav.test.ts
import { describe, it, expect } from 'vitest';
import {
  NAV_AREAS,
  LIBRARY_SUBS,
  PLUGINS_SUBS,
  navTestId,
  defaultNav,
  type Nav,
} from '../../../../src/renderer/components/shell/nav.js';

describe('nav model', () => {
  it('exposes the four primary areas in order', () => {
    expect(NAV_AREAS.map((a) => a.area)).toEqual([
      'inicio',
      'biblioteca',
      'plugins',
      'diagnostico',
    ]);
  });

  it('lists the five library subs and two plugins subs', () => {
    expect(LIBRARY_SUBS.map((s) => s.sub)).toEqual([
      'skills',
      'agents',
      'commands',
      'hooks',
      'global-instructions',
    ]);
    expect(PLUGINS_SUBS.map((s) => s.sub)).toEqual(['plugins', 'marketplaces']);
  });

  it('builds nav-* testids', () => {
    expect(navTestId({ area: 'biblioteca', sub: 'skills' })).toBe('nav-skills');
    expect(navTestId({ area: 'inicio' })).toBe('nav-inicio');
    expect(navTestId({ area: 'diagnostico' })).toBe('nav-diagnostico');
  });

  it('lands on início by default', () => {
    expect(defaultNav).toEqual<Nav>({ area: 'inicio' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/renderer/components/shell/nav.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// src/renderer/components/shell/nav.ts
import {
  House,
  SlidersHorizontal,
  Puzzle,
  Activity,
  Sparkles,
  Bot,
  SquareTerminal,
  Webhook,
  NotebookPen,
  Store,
  type LucideIcon,
} from 'lucide-react';

export type Area = 'inicio' | 'biblioteca' | 'plugins' | 'diagnostico';
export type LibrarySub = 'skills' | 'agents' | 'commands' | 'hooks' | 'global-instructions';
export type PluginsSub = 'plugins' | 'marketplaces';

export type Nav =
  | { area: 'inicio' }
  | { area: 'biblioteca'; sub: LibrarySub }
  | { area: 'plugins'; sub: PluginsSub }
  | { area: 'diagnostico' };

export interface AreaDef {
  area: Area;
  label: string; // PT-BR chrome
  glyph: LucideIcon;
}

export interface SubDef<S> {
  sub: S;
  label: string; // EN entity name
  glyph: LucideIcon;
}

export const NAV_AREAS: ReadonlyArray<AreaDef> = [
  { area: 'inicio', label: 'Início', glyph: House },
  { area: 'biblioteca', label: 'Biblioteca', glyph: SlidersHorizontal },
  { area: 'plugins', label: 'Plugins', glyph: Puzzle },
  { area: 'diagnostico', label: 'Diagnóstico', glyph: Activity },
];

export const LIBRARY_SUBS: ReadonlyArray<SubDef<LibrarySub>> = [
  { sub: 'skills', label: 'Skills', glyph: Sparkles },
  { sub: 'agents', label: 'Agents', glyph: Bot },
  { sub: 'commands', label: 'Commands', glyph: SquareTerminal },
  { sub: 'hooks', label: 'Hooks', glyph: Webhook },
  { sub: 'global-instructions', label: 'Global Instructions', glyph: NotebookPen },
];

export const PLUGINS_SUBS: ReadonlyArray<SubDef<PluginsSub>> = [
  { sub: 'plugins', label: 'Plugins', glyph: Puzzle },
  { sub: 'marketplaces', label: 'Marketplaces', glyph: Store },
];

export const defaultNav: Nav = { area: 'inicio' };

/** Stable `nav-<id>` testid: the sub id when present, else the area id. */
export function navTestId(nav: Nav): string {
  return 'sub' in nav ? `nav-${nav.sub}` : `nav-${nav.area}`;
}

/** Default sub when an area with subs is first entered. */
export function defaultSubFor(area: Area): Nav {
  if (area === 'biblioteca') return { area, sub: 'skills' };
  if (area === 'plugins') return { area, sub: 'plugins' };
  return { area } as Nav;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/renderer/components/shell/nav.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/shell/nav.ts tests/renderer/components/shell/nav.test.ts
git commit -m "feat(shell): add two-level Nav model + registry" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4.2: `Logo` brand mark

**Files:**
- Create: `src/renderer/assets/Logo.tsx`

- [ ] **Step 1: Write the component** (no test — pure SVG)

```tsx
// src/renderer/assets/Logo.tsx
/** OGS brand mark for the TopNav. Inherits currentColor (Ink in light, Cream in dark). */
export function Logo({ size = 22 }: { size?: number }): React.ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      role="img"
    >
      <rect x="1.5" y="1.5" width="21" height="21" rx="6" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 7v10M7 12h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npm run typecheck`
Expected: PASS.
```bash
git add src/renderer/assets/Logo.tsx
git commit -m "feat(shell): add OGS logo mark" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4.3: `TopNav`

**Files:**
- Create: `src/renderer/components/shell/TopNav.tsx`
- Test: `tests/renderer/components/shell/TopNav.test.tsx`

**Props contract:**
```ts
interface TopNavProps {
  active: Area;
  onSelectArea: (area: Area) => void;
  onOpenSettings: () => void;
  onOpenCommandPalette: () => void;
  healthSeverity?: 'ok' | 'warning' | 'error';
}
```

- [ ] **Step 1: Write the failing test**

```tsx
// tests/renderer/components/shell/TopNav.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TopNav } from '../../../../src/renderer/components/shell/TopNav.js';
import { mockApi, ok, renderWithShell, type CallSpy } from '../../test-utils.js';

let call: CallSpy;
beforeEach(() => {
  call = mockApi();
  call.mockResolvedValue(ok({ ui: { theme: 'light' }, adapters: { claude: { enabled: true } }, linkedRepos: [], language: 'off' }));
});

const noop = () => undefined;

describe('TopNav', () => {
  it('renders the four primary area tabs', () => {
    renderWithShell(
      <TopNav active="inicio" onSelectArea={noop} onOpenSettings={noop} onOpenCommandPalette={noop} />,
    );
    expect(screen.getByTestId('nav-inicio')).toBeInTheDocument();
    expect(screen.getByTestId('nav-biblioteca')).toBeInTheDocument();
    expect(screen.getByTestId('nav-plugins')).toBeInTheDocument();
    expect(screen.getByTestId('nav-diagnostico')).toBeInTheDocument();
  });

  it('selects an area on click', async () => {
    const onSelectArea = vi.fn();
    renderWithShell(
      <TopNav active="inicio" onSelectArea={onSelectArea} onOpenSettings={noop} onOpenCommandPalette={noop} />,
    );
    await userEvent.click(screen.getByTestId('nav-biblioteca'));
    expect(onSelectArea).toHaveBeenCalledWith('biblioteca');
  });

  it('opens settings and the command palette via their controls', async () => {
    const onOpenSettings = vi.fn();
    const onOpenCommandPalette = vi.fn();
    renderWithShell(
      <TopNav active="inicio" onSelectArea={noop} onOpenSettings={onOpenSettings} onOpenCommandPalette={onOpenCommandPalette} />,
    );
    await userEvent.click(screen.getByTestId('nav-settings'));
    await userEvent.click(screen.getByTestId('command-palette-trigger'));
    expect(onOpenSettings).toHaveBeenCalledOnce();
    expect(onOpenCommandPalette).toHaveBeenCalledOnce();
  });

  it('shows the sync StatusPill carrying the health severity', () => {
    renderWithShell(
      <TopNav active="inicio" onSelectArea={noop} onOpenSettings={noop} onOpenCommandPalette={noop} healthSeverity="error" />,
    );
    expect(screen.getByTestId('status-pill-sync')).toHaveAttribute('data-variant', 'error');
  });

  it('toggles the theme through useThemeMode', async () => {
    renderWithShell(
      <TopNav active="inicio" onSelectArea={noop} onOpenSettings={noop} onOpenCommandPalette={noop} />,
    );
    await userEvent.click(screen.getByTestId('theme-toggle'));
    expect(call).toHaveBeenCalledWith('settings.merge', expect.objectContaining({ ui: expect.any(Object) }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/renderer/components/shell/TopNav.test.tsx`
Expected: FAIL — `TopNav` and `renderWithShell` not found. (`renderWithShell` is added in Task 4.7; if running this task before 4.7, create the helper first or temporarily wrap inline.)

- [ ] **Step 3: Write the implementation**

```tsx
// src/renderer/components/shell/TopNav.tsx
import { AppBar, Box, Button, IconButton, Stack, Tab, Tabs, Toolbar, Tooltip, Typography } from '@mui/material';
import { Command, Moon, Sun } from 'lucide-react';
import { Logo } from '../../assets/Logo.js';
import { Icon } from '../ds/Icon.js';
import { Kicker } from '../ds/Kicker.js';
import { StatusPill, type StatusPillVariant } from '../ds/StatusPill.js';
import { useThemeMode } from '../../lib/theme-mode-context.js';
import { NAV_AREAS, type Area } from './nav.js';

interface TopNavProps {
  active: Area;
  onSelectArea: (area: Area) => void;
  onOpenSettings: () => void;
  onOpenCommandPalette: () => void;
  healthSeverity?: 'ok' | 'warning' | 'error';
}

const SYNC_VARIANT: Record<'ok' | 'warning' | 'error', StatusPillVariant> = {
  ok: 'synced',
  warning: 'unsynced',
  error: 'error',
};
const SYNC_LABEL: Record<'ok' | 'warning' | 'error', string> = {
  ok: 'sincronizado',
  warning: 'atenção',
  error: 'erro',
};

export function TopNav({
  active,
  onSelectArea,
  onOpenSettings,
  onOpenCommandPalette,
  healthSeverity,
}: TopNavProps): React.ReactElement {
  const { resolved, setTheme } = useThemeMode();
  const isDark = resolved === 'dark';

  return (
    <AppBar
      position="sticky"
      elevation={0}
      color="default"
      sx={(theme) => ({
        bgcolor: 'background.paper',
        borderBottom: `1px solid ${theme.palette.divider}`,
      })}
    >
      <Toolbar sx={{ gap: 2 }}>
        {/* Brand */}
        <Stack direction="row" alignItems="center" gap={1} sx={{ color: 'text.primary' }}>
          <Logo />
          <Box sx={{ lineHeight: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.1 }}>
              Superset AI
            </Typography>
            <Kicker>OGS · TECNOLOGIA BRASIL</Kicker>
          </Box>
        </Stack>

        {/* Primary tabs (Azul indicator) */}
        <Tabs
          value={active}
          onChange={(_, v: Area) => onSelectArea(v)}
          textColor="inherit"
          indicatorColor="secondary"
          sx={{ ml: 2, flexGrow: 1, minHeight: 'auto' }}
        >
          {NAV_AREAS.map((a) => (
            <Tab
              key={a.area}
              value={a.area}
              label={a.label}
              data-testid={`nav-${a.area}`}
              icon={<Icon glyph={a.glyph} size={16} />}
              iconPosition="start"
              sx={{ minHeight: 48 }}
            />
          ))}
        </Tabs>

        {/* Right cluster */}
        <Stack direction="row" alignItems="center" gap={1}>
          <Tooltip title="Buscar e navegar (⌘K)">
            <Button
              data-testid="command-palette-trigger"
              onClick={onOpenCommandPalette}
              color="inherit"
              variant="outlined"
              size="small"
              startIcon={<Icon glyph={Command} size={14} />}
            >
              ⌘K
            </Button>
          </Tooltip>
          {healthSeverity !== undefined && (
            <StatusPill
              variant={SYNC_VARIANT[healthSeverity]}
              label={SYNC_LABEL[healthSeverity]}
              testId="sync"
            />
          )}
          <Tooltip title={isDark ? 'Tema claro' : 'Tema escuro'}>
            <IconButton
              data-testid="theme-toggle"
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              size="small"
              sx={{ color: 'text.secondary' }}
              aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
            >
              <Icon glyph={isDark ? Sun : Moon} size={18} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Configurações">
            <IconButton
              data-testid="nav-settings"
              onClick={onOpenSettings}
              size="small"
              sx={{ color: 'text.secondary' }}
              aria-label="Configurações"
            >
              <Icon glyph={SettingsGlyph} size={18} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
```
Replace `SettingsGlyph` with an import: add `Settings as SettingsGlyph` to the `lucide-react` import line (avoids colliding with any local `Settings`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/renderer/components/shell/TopNav.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/shell/TopNav.tsx tests/renderer/components/shell/TopNav.test.tsx
git commit -m "feat(shell): add TopNav (tabs, sync pill, theme toggle, palette trigger)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4.4: `SubRail`

**Files:**
- Create: `src/renderer/components/shell/SubRail.tsx`
- Test: `tests/renderer/components/shell/SubRail.test.tsx`

**Props contract:**
```ts
interface SubRailProps {
  nav: Nav;                         // current nav (area + sub)
  onSelect: (nav: Nav) => void;
}
```
Renders nothing for `inicio`/`diagnostico`; for `biblioteca`/`plugins` renders the contextual sub items with a section `Kicker`.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/renderer/components/shell/SubRail.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SubRail } from '../../../../src/renderer/components/shell/SubRail.js';
import { renderWithShell } from '../../test-utils.js';

describe('SubRail', () => {
  it('renders nothing for areas without subs', () => {
    const { container } = renderWithShell(
      <SubRail nav={{ area: 'inicio' }} onSelect={() => undefined} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the five Library subs and marks the active one', () => {
    renderWithShell(
      <SubRail nav={{ area: 'biblioteca', sub: 'agents' }} onSelect={() => undefined} />,
    );
    expect(screen.getByTestId('nav-skills')).toBeInTheDocument();
    expect(screen.getByTestId('nav-global-instructions')).toBeInTheDocument();
    expect(screen.getByTestId('nav-agents')).toHaveAttribute('aria-current', 'page');
  });

  it('selects a sub on click', async () => {
    const onSelect = vi.fn();
    renderWithShell(<SubRail nav={{ area: 'biblioteca', sub: 'skills' }} onSelect={onSelect} />);
    await userEvent.click(screen.getByTestId('nav-hooks'));
    expect(onSelect).toHaveBeenCalledWith({ area: 'biblioteca', sub: 'hooks' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/renderer/components/shell/SubRail.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```tsx
// src/renderer/components/shell/SubRail.tsx
import { Box, List, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import { Icon } from '../ds/Icon.js';
import { Kicker } from '../ds/Kicker.js';
import {
  LIBRARY_SUBS,
  PLUGINS_SUBS,
  type Nav,
  type SubDef,
} from './nav.js';

interface SubRailProps {
  nav: Nav;
  onSelect: (nav: Nav) => void;
}

export const SUBRAIL_WIDTH = 220;

export function SubRail({ nav, onSelect }: SubRailProps): React.ReactElement | null {
  if (nav.area === 'inicio' || nav.area === 'diagnostico') return null;

  const section = nav.area === 'biblioteca' ? 'Biblioteca' : 'Plugins';
  const items: ReadonlyArray<SubDef<string>> =
    nav.area === 'biblioteca' ? LIBRARY_SUBS : PLUGINS_SUBS;
  const activeSub = nav.sub;

  return (
    <Box
      component="nav"
      aria-label={section}
      sx={(theme) => ({
        width: SUBRAIL_WIDTH,
        flexShrink: 0,
        borderRight: `1px solid ${theme.palette.divider}`,
        bgcolor: theme.ogs.surfaces.rail,
        px: 1.5,
        py: 2,
      })}
    >
      <Box sx={{ px: 1, mb: 1 }}>
        <Kicker>{section}</Kicker>
      </Box>
      <List dense disablePadding>
        {items.map((item) => {
          const selected = item.sub === activeSub;
          return (
            <ListItemButton
              key={item.sub}
              data-testid={`nav-${item.sub}`}
              selected={selected}
              {...(selected ? { 'aria-current': 'page' as const } : {})}
              onClick={() => onSelect({ area: nav.area, sub: item.sub } as Nav)}
              sx={(theme) => ({
                borderRadius: theme.ogs.radius.sm,
                mb: 0.5,
                borderLeft: selected
                  ? `2px solid ${theme.palette.info.main}`
                  : '2px solid transparent',
                '&.Mui-selected': { bgcolor: 'action.selected' },
              })}
            >
              <ListItemIcon sx={{ minWidth: 30, color: selected ? 'text.primary' : 'text.secondary' }}>
                <Icon glyph={item.glyph} size={16} />
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                slotProps={{ primary: { variant: 'body2', sx: { fontWeight: selected ? 600 : 400 } } }}
              />
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/renderer/components/shell/SubRail.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/shell/SubRail.tsx tests/renderer/components/shell/SubRail.test.tsx
git commit -m "feat(shell): add contextual SubRail" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4.5: `CommandPalette`

**Files:**
- Create: `src/renderer/components/shell/CommandPalette.tsx`
- Test: `tests/renderer/components/shell/CommandPalette.test.tsx`

**Props contract:**
```ts
interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (nav: Nav) => void;
  onCreate: (sub: LibrarySub) => void; // "Nova skill" etc.
}
```
Builds a flat command list from `NAV_AREAS` + `LIBRARY_SUBS` + `PLUGINS_SUBS` (jump commands) plus create commands for the four editable Library subs (`skills`/`agents`/`commands`/`hooks`). Filterable by a controlled text field. Selecting a jump calls `onNavigate` then `onClose`; selecting a create calls `onCreate` then `onClose`.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/renderer/components/shell/CommandPalette.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommandPalette } from '../../../../src/renderer/components/shell/CommandPalette.js';
import { renderWithShell } from '../../test-utils.js';

const noop = () => undefined;

describe('CommandPalette', () => {
  it('is hidden when closed', () => {
    renderWithShell(<CommandPalette open={false} onClose={noop} onNavigate={noop} onCreate={noop} />);
    expect(screen.queryByTestId('command-palette')).toBeNull();
  });

  it('filters commands by query and navigates on select', async () => {
    const onNavigate = vi.fn();
    const onClose = vi.fn();
    renderWithShell(
      <CommandPalette open onClose={onClose} onNavigate={onNavigate} onCreate={noop} />,
    );
    const input = screen.getByTestId('command-palette-input');
    await userEvent.type(input, 'global');
    await userEvent.click(screen.getByText(/Global Instructions/i));
    expect(onNavigate).toHaveBeenCalledWith({ area: 'biblioteca', sub: 'global-instructions' });
    expect(onClose).toHaveBeenCalled();
  });

  it('offers create actions for editable entities', async () => {
    const onCreate = vi.fn();
    renderWithShell(<CommandPalette open onClose={noop} onNavigate={noop} onCreate={onCreate} />);
    await userEvent.type(screen.getByTestId('command-palette-input'), 'Nova skill');
    await userEvent.click(screen.getByText('Nova skill'));
    expect(onCreate).toHaveBeenCalledWith('skills');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/renderer/components/shell/CommandPalette.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```tsx
// src/renderer/components/shell/CommandPalette.tsx
import { useMemo, useState } from 'react';
import {
  Dialog,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
} from '@mui/material';
import { Search, type LucideIcon } from 'lucide-react';
import { Icon } from '../ds/Icon.js';
import {
  LIBRARY_SUBS,
  NAV_AREAS,
  PLUGINS_SUBS,
  type LibrarySub,
  type Nav,
} from './nav.js';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (nav: Nav) => void;
  onCreate: (sub: LibrarySub) => void;
}

interface Command {
  id: string;
  label: string;
  glyph: LucideIcon;
  run: () => void;
}

const CREATABLE: ReadonlyArray<{ sub: LibrarySub; label: string }> = [
  { sub: 'skills', label: 'Nova skill' },
  { sub: 'agents', label: 'Novo agent' },
  { sub: 'commands', label: 'Novo command' },
  { sub: 'hooks', label: 'Novo hook' },
];

export function CommandPalette({
  open,
  onClose,
  onNavigate,
  onCreate,
}: CommandPaletteProps): React.ReactElement {
  const [query, setQuery] = useState('');

  const commands = useMemo<Command[]>(() => {
    const go = (nav: Nav) => () => {
      onNavigate(nav);
      onClose();
    };
    const jumps: Command[] = [
      ...NAV_AREAS.filter((a) => a.area === 'inicio' || a.area === 'diagnostico').map((a) => ({
        id: `go-${a.area}`,
        label: a.label,
        glyph: a.glyph,
        run: go({ area: a.area } as Nav),
      })),
      ...LIBRARY_SUBS.map((s) => ({
        id: `go-${s.sub}`,
        label: s.label,
        glyph: s.glyph,
        run: go({ area: 'biblioteca', sub: s.sub }),
      })),
      ...PLUGINS_SUBS.map((s) => ({
        id: `go-${s.sub}`,
        label: s.label,
        glyph: s.glyph,
        run: go({ area: 'plugins', sub: s.sub }),
      })),
    ];
    const creates: Command[] = CREATABLE.map((c) => {
      const def = LIBRARY_SUBS.find((s) => s.sub === c.sub);
      return {
        id: `new-${c.sub}`,
        label: c.label,
        glyph: def ? def.glyph : Search,
        run: () => {
          onCreate(c.sub);
          onClose();
        },
      };
    });
    return [...jumps, ...creates];
  }, [onNavigate, onCreate, onClose]);

  const filtered = commands.filter((c) =>
    c.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <Dialog
      open={open}
      onClose={() => {
        setQuery('');
        onClose();
      }}
      fullWidth
      maxWidth="sm"
      slotProps={{ paper: { 'data-testid': 'command-palette', elevation: 8 } }}
    >
      <TextField
        autoFocus
        fullWidth
        placeholder="Buscar telas e ações…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        slotProps={{ htmlInput: { 'data-testid': 'command-palette-input', 'aria-label': 'Buscar' } }}
        sx={{ p: 1.5 }}
      />
      <List dense sx={{ maxHeight: 360, overflowY: 'auto' }}>
        {filtered.map((c) => (
          <ListItemButton key={c.id} onClick={c.run}>
            <ListItemIcon sx={{ minWidth: 30 }}>
              <Icon glyph={c.glyph} size={16} />
            </ListItemIcon>
            <ListItemText primary={c.label} />
          </ListItemButton>
        ))}
      </List>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/renderer/components/shell/CommandPalette.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/shell/CommandPalette.tsx tests/renderer/components/shell/CommandPalette.test.tsx
git commit -m "feat(shell): add ⌘K CommandPalette (jump + create)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4.6: `AppShell`

**Files:**
- Create: `src/renderer/components/shell/AppShell.tsx`
- Test: `tests/renderer/components/shell/AppShell.test.tsx`

**Props contract:**
```ts
interface AppShellProps {
  nav: Nav;
  onNavigate: (nav: Nav) => void;
  onOpenSettings: () => void;
  healthSeverity?: 'ok' | 'warning' | 'error';
  children: ReactNode; // the active screen, chosen by the parent from `nav`
}
```
`AppShell` renders TopNav (area selection → `defaultSubFor`), SubRail (sub selection), the ⌘K palette (open via TopNav trigger **and** a global `keydown` for ⌘K/Ctrl-K), and `children`. The shell root carries `data-testid="app-shell"` and `data-testid="main-screen"` (the latter preserved for e2e — put both on the same root `Box`, or nest a div; simplest: root `Box data-testid="main-screen"` with inner `data-testid="app-shell"`).

- [ ] **Step 1: Write the failing test**

```tsx
// tests/renderer/components/shell/AppShell.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppShell } from '../../../../src/renderer/components/shell/AppShell.js';
import { mockApi, ok, renderWithShell, type CallSpy } from '../../test-utils.js';

let call: CallSpy;
beforeEach(() => {
  call = mockApi();
  call.mockResolvedValue(ok({ ui: { theme: 'light' }, adapters: { claude: { enabled: true } }, linkedRepos: [], language: 'off' }));
});

describe('AppShell', () => {
  it('switches to a default sub when entering an area with subs', async () => {
    const onNavigate = vi.fn();
    renderWithShell(
      <AppShell nav={{ area: 'inicio' }} onNavigate={onNavigate} onOpenSettings={() => undefined}>
        <div data-testid="screen" />
      </AppShell>,
    );
    await userEvent.click(screen.getByTestId('nav-biblioteca'));
    expect(onNavigate).toHaveBeenCalledWith({ area: 'biblioteca', sub: 'skills' });
  });

  it('opens the command palette on ⌘K', async () => {
    renderWithShell(
      <AppShell nav={{ area: 'inicio' }} onNavigate={() => undefined} onOpenSettings={() => undefined}>
        <div data-testid="screen" />
      </AppShell>,
    );
    await userEvent.keyboard('{Meta>}k{/Meta}');
    expect(screen.getByTestId('command-palette')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/renderer/components/shell/AppShell.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```tsx
// src/renderer/components/shell/AppShell.tsx
import { useEffect, useState, type ReactNode } from 'react';
import { Box, Container } from '@mui/material';
import { TopNav } from './TopNav.js';
import { SubRail } from './SubRail.js';
import { CommandPalette } from './CommandPalette.js';
import { defaultSubFor, type Area, type LibrarySub, type Nav } from './nav.js';

interface AppShellProps {
  nav: Nav;
  onNavigate: (nav: Nav) => void;
  onOpenSettings: () => void;
  healthSeverity?: 'ok' | 'warning' | 'error';
  children: ReactNode;
}

export function AppShell({
  nav,
  onNavigate,
  onOpenSettings,
  healthSeverity,
  children,
}: AppShellProps): React.ReactElement {
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const selectArea = (area: Area): void => onNavigate(defaultSubFor(area));
  const createEntity = (sub: LibrarySub): void => onNavigate({ area: 'biblioteca', sub });

  return (
    <Box
      data-testid="main-screen"
      sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}
    >
      <TopNav
        active={nav.area}
        onSelectArea={selectArea}
        onOpenSettings={onOpenSettings}
        onOpenCommandPalette={() => setPaletteOpen(true)}
        {...(healthSeverity !== undefined ? { healthSeverity } : {})}
      />
      <Box data-testid="app-shell" sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <SubRail nav={nav} onSelect={onNavigate} />
        <Box component="main" sx={{ flexGrow: 1, minWidth: 0, overflowY: 'auto' }}>
          <Container maxWidth="lg" sx={{ py: 4 }}>
            {children}
          </Container>
        </Box>
      </Box>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={(n) => onNavigate(n)}
        onCreate={createEntity}
      />
    </Box>
  );
}
```

> **Create flow note:** for now "Nova skill" from the palette navigates to the Skills sub (where the user clicks "Nova"). Wiring the create dialog to auto-open is out of scope (spec §13 keeps palette = nav + create-intent). If desired later, thread a `createIntent` into the list screen.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/renderer/components/shell/AppShell.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/shell/AppShell.tsx tests/renderer/components/shell/AppShell.test.tsx
git commit -m "feat(shell): add AppShell composing TopNav + SubRail + palette" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4.7: Test helper `renderWithShell`

**Files:**
- Modify: `tests/renderer/test-utils.tsx` (append; current content at `tests/renderer/test-utils.tsx:1-49`)

- [ ] **Step 1: Add the helper**

Append to `test-utils.tsx`:
```tsx
import { ThemeModeProvider } from '../../src/renderer/lib/theme-mode-context.js';

/** Renders inside ThemeModeProvider + QueryClientProvider — for shell/screen tests. */
export function renderWithShell(
  ui: ReactElement,
  options?: RenderOptions & { client?: QueryClient },
) {
  const { client: providedClient, ...rest } = options ?? {};
  const client = providedClient ?? makeTestQueryClient();
  return {
    client,
    ...render(ui, {
      ...rest,
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>
          <ThemeModeProvider>{children}</ThemeModeProvider>
        </QueryClientProvider>
      ),
    }),
  };
}
```

- [ ] **Step 2: Run the shell tests**

Run: `npx vitest run tests/renderer/components/shell/`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/renderer/test-utils.tsx
git commit -m "test: add renderWithShell helper" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4.8: Rewrite `Main.tsx`, delete `Sidebar.tsx`, drop `@mui/icons-material`

**Files:**
- Modify: `src/renderer/screens/Main.tsx` (full rewrite of `src/renderer/screens/Main.tsx:1-56`)
- Modify: `src/renderer/screens/starter-pack/StarterPackScreen.tsx` (change `onNavigate` prop type — see below)
- Delete: `src/renderer/components/Sidebar.tsx`
- Modify: `package.json` (remove `@mui/icons-material`)
- Modify: `tests/renderer/screens/main.test.tsx`, `tests/renderer/screens/main-health.test.tsx`

- [ ] **Step 1: Update the failing navigation tests first (TDD)**

Rewrite `tests/renderer/screens/main.test.tsx` describe block — replace the four tests with these (and switch `render` to `renderWithShell`):
```tsx
import { renderWithShell, mockApi, ok, fail, type CallSpy } from '../test-utils.js';
const render = renderWithShell;
// setupRoute unchanged …

describe('<Main> — shell navigation', () => {
  it('renders the starter pack as the landing screen inside the shell', async () => {
    setupRoute();
    render(<Main onOpenSettings={() => undefined} />);
    expect(await screen.findByTestId('starter-pack-screen')).toBeInTheDocument();
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByTestId('nav-settings')).toBeInTheDocument();
  });

  it('navigates to the skills list via the Biblioteca sub-rail', async () => {
    setupRoute();
    render(<Main onOpenSettings={() => undefined} />);
    await screen.findByTestId('starter-pack-screen');
    await userEvent.click(screen.getByTestId('nav-biblioteca'));
    await userEvent.click(screen.getByTestId('nav-skills'));
    expect(await screen.findByTestId('entity-list-skill')).toBeInTheDocument();
  });

  it('does not render linked repos UI in the landing view', async () => {
    setupRoute();
    render(<Main onOpenSettings={() => undefined} />);
    await screen.findByTestId('starter-pack-screen');
    expect(screen.queryByRole('button', { name: /add repo/i })).toBeNull();
  });
});
```
*(The "expandable Customizations group" test is deleted — the two-level shell has no collapsible group.)*

Rewrite `tests/renderer/screens/main-health.test.tsx` to use `renderWithShell` and the new testids:
```tsx
import { mockApi, ok, fail, renderWithShell, type CallSpy } from '../test-utils.js';
// report()/setupRoute() unchanged …

describe('<Main> — sync status + diagnostics', () => {
  it('paints the TopNav sync pill with the report worst severity', async () => {
    setupRoute('error');
    renderWithShell(<Main onOpenSettings={() => undefined} />);
    const pill = await screen.findByTestId('status-pill-sync');
    expect(pill).toHaveAttribute('data-variant', 'error');
  });

  it('navigates to Diagnóstico from the TopNav', async () => {
    setupRoute('ok');
    renderWithShell(<Main onOpenSettings={() => undefined} />);
    await screen.findByTestId('starter-pack-screen');
    await userEvent.click(screen.getByTestId('nav-diagnostico'));
    expect(await screen.findByTestId('health-screen')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/renderer/screens/main.test.tsx tests/renderer/screens/main-health.test.tsx`
Expected: FAIL — `Main` still renders `Sidebar`; `app-shell`/`nav-*`/`status-pill-sync` not found.

- [ ] **Step 3: Rewrite `Main.tsx`**

```tsx
// src/renderer/screens/Main.tsx
import { useState } from 'react';
import { AppShell } from '../components/shell/AppShell.js';
import { defaultNav, type LibrarySub, type Nav } from '../components/shell/nav.js';
import { SkillList } from './skills/SkillList.js';
import { AgentList } from './agents/AgentList.js';
import { CommandList } from './commands/CommandList.js';
import { HookList } from './hooks/HookList.js';
import { GlobalInstructionScreen } from './global-instructions/GlobalInstructionScreen.js';
import { MarketplaceList } from './marketplaces/MarketplaceList.js';
import { PluginList } from './plugins/PluginList.js';
import { StarterPackScreen } from './starter-pack/StarterPackScreen.js';
import { HealthScreen } from './health/HealthScreen.js';
import { useHealthReport } from '../hooks/use-health-report.js';
import { useHealthNotifications } from '../hooks/use-health-notifications.js';

interface MainProps {
  onOpenSettings: () => void;
}

function screenFor(nav: Nav, navigate: (n: Nav) => void): React.ReactElement {
  if (nav.area === 'inicio') return <StarterPackScreen onNavigate={navigate} />;
  if (nav.area === 'diagnostico') return <HealthScreen />;
  if (nav.area === 'plugins') {
    return nav.sub === 'plugins' ? <PluginList scope="personal" /> : <MarketplaceList />;
  }
  // biblioteca
  switch (nav.sub) {
    case 'skills':
      return <SkillList />;
    case 'agents':
      return <AgentList />;
    case 'commands':
      return <CommandList />;
    case 'hooks':
      return <HookList />;
    case 'global-instructions':
      return <GlobalInstructionScreen />;
  }
}

export function Main({ onOpenSettings }: MainProps): React.ReactElement {
  const [nav, setNav] = useState<Nav>(defaultNav);
  const { data: healthReport } = useHealthReport('personal');
  useHealthNotifications(healthReport);

  return (
    <AppShell
      nav={nav}
      onNavigate={setNav}
      onOpenSettings={onOpenSettings}
      {...(healthReport ? { healthSeverity: healthReport.worst } : {})}
    >
      {screenFor(nav, setNav)}
    </AppShell>
  );
}
```

- [ ] **Step 4: Adapt `StarterPackScreen` navigation prop**

`StarterPackScreen` previously took `onNavigate: (tab: SidebarTab) => void` and called e.g. `onNavigate('marketplaces')`, `onNavigate('global-instructions')`. Change its prop to `onNavigate: (nav: Nav) => void` (import `Nav` from `../../components/shell/nav.js`) and update each call site:
- `onNavigate('marketplaces')` → `onNavigate({ area: 'plugins', sub: 'marketplaces' })`
- `onNavigate('global-instructions')` → `onNavigate({ area: 'biblioteca', sub: 'global-instructions' })`
- any `onNavigate('plugins')` → `onNavigate({ area: 'plugins', sub: 'plugins' })`

Run `grep -n "onNavigate(" src/renderer/screens/starter-pack/StarterPackScreen.tsx` to find every call site and convert it.

- [ ] **Step 5: Delete `Sidebar.tsx` and remove the dependency**

```bash
git rm src/renderer/components/Sidebar.tsx
npm uninstall @mui/icons-material
grep -rn "@mui/icons-material" src tests
```
Expected grep output: none.

- [ ] **Step 6: Run the full suite + typecheck + lint**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS. Confirm `main.test.tsx` and `main-health.test.tsx` pass with the new testids.

- [ ] **Step 7: Smoke-test (Manual QA)**

Run: `npm run dev` — confirm TopNav tabs switch areas, SubRail appears for Biblioteca/Plugins, ⌘K opens the palette, theme toggle flips and persists across restart, sync pill reflects health.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(shell): replace Sidebar with TopNav+SubRail+CommandPalette" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

**Phase 4 gate:** `npm run lint && npm run typecheck && npm test` green; zero `@mui/icons-material` references.

---

# Phase 5 — `feat(screens): apply OGS to lists, detail, editor, states`

Restyle existing screens/components onto the `ds/*` layer. These tasks change **structure + states + testids/StatusPill**, which are tested, plus **visual `sx`** which is Manual-QA'd. No copy changes here (copy/SDE pass is Phase 6) — keep existing strings verbatim so Phase 5 tests stay stable.

> **Coverage guard:** `src/renderer/screens/**` and `App.tsx` are coverage-gated (lines/functions/statements 80, branches 70). After each task, run `npx vitest --project jsdom --coverage` if you touched a screen heavily, to confirm thresholds hold. New `components/shell/**` and `components/ds/**` are not in the include list.

### Task 5.1: `EntityDataGrid` — states + Cards/Table toggle

**Files:**
- Modify: `src/renderer/components/EntityDataGrid/EntityDataGrid.tsx` (`:1-216`), `Toolbar.tsx` (`:1-52`), `CardView.tsx`, `TableView.tsx`
- Test: `tests/renderer/EntityDataGrid.test.tsx` (extend)

- [ ] **Step 1: Write/extend the failing test** — wire the Cards/Table toggle (currently `TableView` exists but is never rendered; `view` is hardcoded to `'card'`):
```tsx
// add to tests/renderer/EntityDataGrid.test.tsx
it('switches between card and table views', async () => {
  // render the grid with >0 items (reuse existing fixture/helper in this file)
  // …
  await userEvent.click(screen.getByTestId('entity-grid-view-table-thing'));
  expect(screen.getByTestId('entity-grid-table-thing')).toBeInTheDocument();
  await userEvent.click(screen.getByTestId('entity-grid-view-card-thing'));
  expect(screen.getByTestId('entity-grid-cards-thing')).toBeInTheDocument();
});
```
(Use the existing entity name in this test file — replace `thing` with the fixture's `entity.name`.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/renderer/EntityDataGrid.test.tsx`
Expected: FAIL — no view toggle testids; table never renders.

- [ ] **Step 3: Implement**
  - In `EntityDataGrid.tsx`: replace the hardcoded `view="card"` (`:75`) with `const [view, setView] = useState<ViewMode>(entity.defaultView ?? 'card')`, persist via the existing `viewStorageKey(entity.name)` localStorage key (currently unused, `utils.ts:viewStorageKey`), pass `view`/`onViewChange={setView}` into `Toolbar`, and render `view === 'table' ? <TableView …/> : <CardView …/>`.
  - In `Toolbar.tsx`: add a MUI `ToggleButtonGroup` (`size="small"`, `exclusive`) with two buttons — Cards / Tabela — carrying `data-testid={`entity-grid-view-card-${entityName}`}` and `entity-grid-view-table-${entityName}`. Use Lucide `LayoutGrid` and `Table` (via `ds/Icon`). Wire `value={view}` / `onChange`.
  - Restyle: `LoadingState kind="list"` replaces the inline `CircularProgress + "Loading…"` (`EntityDataGrid.tsx:86-99`); `ErrorState` replaces the inline error `Alert` (`:80-84`), keeping the same message source. Cards already use `variant="outlined"` — confirm hairline border via theme (no shadow at rest, `boxShadow: theme.ogs.shadow.sm` on hover).

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/renderer/EntityDataGrid.test.tsx`
Expected: PASS.

- [ ] **Step 5: Manual QA + commit** — `npm run dev`, confirm toggle + states look OGS.
```bash
git add src/renderer/components/EntityDataGrid tests/renderer/EntityDataGrid.test.tsx
git commit -m "feat(screens): OGS states + Cards/Table toggle in EntityDataGrid" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 5.2: Customization list screens + `StatusPill` for origin

**Files:**
- Modify: `src/renderer/components/CustomizationListScreen.tsx` (`:1-306`)
- Modify: `src/renderer/components/PluginOriginBadge.tsx` → re-implement as a thin wrapper over `StatusPill variant="plugin"` (keep the export + `data-testid="plugin-origin-badge-${pluginId}"` so `CustomizationListScreen.tsx:131-138` and tests keep working).
- Test: `tests/renderer/components/CustomizationListScreen.test.tsx` (verify it still passes; add an assertion that origin renders as a StatusPill).

- [ ] **Step 1: Re-point `PluginOriginBadge`** to render `StatusPill`:
```tsx
// src/renderer/components/PluginOriginBadge.tsx
import { Tooltip } from '@mui/material';
import { StatusPill } from './ds/StatusPill.js';

export function PluginOriginBadge({ pluginId }: { pluginId: string }): React.ReactElement {
  return (
    <Tooltip title={`Provided by plugin '${pluginId}' (read-only)`}>
      <span data-testid={`plugin-origin-badge-${pluginId}`}>
        <StatusPill variant="plugin" label={pluginId} />
      </span>
    </Tooltip>
  );
}
```

- [ ] **Step 2: Adopt `ScreenHeader` + states in `CustomizationListScreen`** — replace the header `Stack` (`:190-197`) with `<ScreenHeader kicker="Biblioteca" title={title} subtitle={countSubtitle} actions={<Button … startIcon={<Icon glyph={Plus} size={16}/>}>New</Button>} />`. Keep the `New` label (Phase 6 changes copy). Replace the inline empty state (`:217-240`) with `<EmptyState glyph={Sparkles} title={…} cta={…} testId={entityType} />` — but **keep `data-testid="entity-list-${entityType}"`** on the outer container (main.test depends on `entity-list-skill`). The grid already handles loading/error via Task 5.1.

- [ ] **Step 3: Run the affected tests**

Run: `npx vitest run tests/renderer/components/CustomizationListScreen.test.tsx tests/renderer/screens/skills/SkillList.test.tsx`
Expected: PASS (adjust the empty-state query in `SkillList.test.tsx:49` only if you changed the "No skills yet" string — you did **not** in Phase 5).

- [ ] **Step 4: Manual QA + commit**
```bash
git add src/renderer/components/CustomizationListScreen.tsx src/renderer/components/PluginOriginBadge.tsx tests/renderer/components/CustomizationListScreen.test.tsx
git commit -m "feat(screens): OGS list screens + StatusPill origin badge" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 5.3: Detail drawers + editor

**Files (modify):** `DetailDrawer.tsx` (keep `elevation`/shadow on the drawer paper — overlays keep shadow per §5), `CustomizationViewDrawer.tsx`, `EntityViewer.tsx`, `CustomizationEditor.tsx`, `plugins/PluginDetail.tsx`, `marketplaces/MarketplaceDetail.tsx`.

- [ ] **Step 1: Restyle (Manual-QA, no copy/testid changes):**
  - `DetailDrawer`: drawer paper uses `boxShadow: theme.ogs.shadow.lg` + hairline left border; title uses `Kicker` + mono entity name; key/value rows use `theme.ogs.fonts.mono`.
  - `CustomizationEditor`: Frontmatter card + Body card become `variant="outlined"` OGS cards; Scope chips use Ink; the body textarea mono font (`CustomizationEditor.tsx:264`) switches from the hardcoded string to `theme.ogs.fonts.mono` (read it via an `sx`/`styled` callback). Edit/Split/Preview ToggleButtonGroup keeps its labels.
  - `PluginDetail`/`MarketplaceDetail`: section subtitles → `Kicker`; loading → `LoadingState kind="detail"`; error → `ErrorState`.

- [ ] **Step 2: Run affected tests**

Run: `npx vitest run tests/renderer/components/ tests/renderer/screens/plugins/ tests/renderer/screens/marketplaces/`
Expected: PASS (no testid/copy changes).

- [ ] **Step 3: Manual QA + commit**
```bash
git add src/renderer/components src/renderer/screens/plugins src/renderer/screens/marketplaces
git commit -m "feat(screens): OGS detail drawers + editor" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 5.4: Health, Starter Pack, Global Instructions, Settings, IoError, dialogs

**Files (modify):** `health/HealthScreen.tsx`, `starter-pack/StarterPackScreen.tsx`, `global-instructions/GlobalInstructionScreen.tsx`, `Settings.tsx`, `IoError.tsx`, and the plugin/marketplace dialogs.

- [ ] **Step 1: Restyle each (no copy/SDE changes — Phase 6):**
  - `HealthScreen`: `ScreenHeader kicker="Diagnóstico" title="Diagnostics"` (string stays until Phase 6); severity cards use `StatusPill` variants `ok`/`warning`/`error`; keep `health-screen`, `health-refresh`, `health-all-clear`, `health-category-*`, `health-check-*` testids verbatim.
  - `StarterPackScreen`: wrap header in `ScreenHeader` (keep "SDE Starter Pack" string for now); keep all `starter-pack-*` testids.
  - `GlobalInstructionScreen`: `ScreenHeader`; the four section cards use `Kicker`; keep all testids; loading/error via state components.
  - `Settings`: `ScreenHeader kicker="Configurações" title="Settings"`; keep `settings-screen`, `settings-loading`, `linked-repo-item`, `disable-toast` testids; section headers (`Adapters`, `Language`, `Linked repos`, `GitHub`, `Zona de perigo`) become `Kicker` + body — **do not** translate yet.
  - `IoError`: `ErrorState`-style left bar (it already uses an `Alert severity="error"`); keep `io-error-screen` testid and Retry/Cancel labels.

- [ ] **Step 2: Run the full jsdom suite**

Run: `npx vitest --project jsdom`
Expected: PASS. If any test queried a header by `variant="h5"` heading role and you changed it to `h1` via `ScreenHeader`, update that query.

- [ ] **Step 3: Manual QA + commit**
```bash
git add src/renderer/screens
git commit -m "feat(screens): OGS health, starter-pack, GI, settings, io-error" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

**Phase 5 gate:** `npm run lint && npm run typecheck && npm test` green; coverage thresholds hold.

---

# Phase 6 — `chore(copy): PT-BR chrome + SDE→Superset AI/OGS naming`

Copy pass + naming cleanup. Each copy change that a test asserts on must update the test in the **same** step.

### Copy table (chrome → PT-BR; technical terms stay EN)

| EN (current) | PT-BR | Where |
|---|---|---|
| `New` | `Novo` | CustomizationListScreen `:214` |
| `Search {singular}s…` | `Buscar {singular}s…` | CustomizationListScreen `:206` |
| `No {singular}s yet.` | `Nenhum(a) {singular} ainda.` | CustomizationListScreen `:229-230` (+ `SkillList.test.tsx:49`) |
| `Create your first {singular}` | `Criar {singular}` | `:237` |
| `Edit` / `Duplicate` / `Delete` | `Editar` / `Duplicar` / `Excluir` | `:155/165/175` (+ `SkillList.test.tsx:108-114`) |
| `Confirm deletion` / `Cancel` / `Confirm` | `Confirmar exclusão` / `Cancelar` / `Confirmar` | `:249/256/262` |
| `Settings` (gear tooltip) | `Configurações` | already PT in TopNav |
| `Search…` (grid default) | `Buscar…` | `EntityDataGrid/Toolbar.tsx:33` |
| `Diagnostics` (title) | `Diagnóstico` | `HealthScreen.tsx:57` |
| `Refresh` | `Atualizar` | `HealthScreen.tsx:73-74`, `MarketplaceList.tsx:214` |
| `Everything looks healthy.` | `Tudo certo por aqui.` | `HealthScreen.tsx:98` |
| Retry / Cancel | Tentar novamente / Cancelar | `IoError.tsx:24/27` (+ `io-error.test.tsx:10-11`) |

> Keep EN: entity/type names (`Skills`, `Agents`, `Commands`, `Hooks`, `Global Instructions`), enum values (`plugin`/`personal`/`project`/`synced`), paths, IDs, frontmatter keys. The `linked-repos`/Language settings tests assert `getByLabelText('Language')` and the English helper text — **leave those English** (they mirror the assistant feature) so `settings.test.tsx` stays green, or translate and update the test in the same step. Recommended: leave Language section EN (it is a technical mirror), translate only the chrome.

### Task 6.1: Chrome copy pass

**Files:** the renderer files in the copy table + their tests.

- [ ] **Step 1: Update tests first** for the asserted strings:
  - `tests/renderer/screens/skills/SkillList.test.tsx:49` `getByText(/No skills yet/i)` → `getByText(/Nenhuma skill ainda/i)`; `:108-114` `name: 'Edit'|'Duplicate'|'Delete'` → `'Editar'|'Duplicar'|'Excluir'`.
  - `tests/renderer/screens/io-error.test.tsx:10-11` `/retry/i`,`/cancel/i` → `/tentar novamente/i`,`/cancelar/i`.
  - `tests/renderer/screens/marketplaces/MarketplaceList.test.tsx:26` `/No marketplaces yet/i` → PT equivalent if you translate that empty state.
- [ ] **Step 2: Run to verify they fail**, then make the copy edits, then **Step 3: run to verify they pass**.

Run: `npx vitest --project jsdom`
Expected: FAIL before edits, PASS after.

- [ ] **Step 4: Commit**
```bash
git add src/renderer tests/renderer
git commit -m "chore(copy): PT-BR chrome pass" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 6.2: SDE → Superset AI / OGS (renderer)

**Files:** `StarterPackScreen.tsx` (`:336` "SDE Starter Pack"→"Superset AI · Starter Pack", `:338-339` "SDE environment"→"ambiente OGS", `:357-358` "SDE Profile"→"Perfil OGS", `:433` "discover SDE plugins"→"plugins OGS"), `GlobalInstructionScreen.tsx` (`:322` "Start with the SDE profile"→"Comece com o perfil OGS", `:357-358` "Use the SDE template"→"Usar template OGS"), `lib/default-global-instruction.ts` (`:13` description, `:51` comment — "SDE"→"OGS").

- [ ] **Step 1:** Edit each occurrence. Run `grep -rn "SDE" src/renderer` — expect zero after edits.
- [ ] **Step 2: Run the jsdom suite + the GI tests.**

Run: `npx vitest --project jsdom`
Expected: PASS. (StarterPack/GI tests query by testid, not by these strings — confirm with grep that no test asserts an "SDE" string in the renderer: `grep -rn "SDE" tests/renderer` → none.)

- [ ] **Step 3: Commit**
```bash
git add src/renderer
git commit -m "chore(copy): remove SDE branding from renderer (→ OGS / Superset AI)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 6.3: `SDE-AI` → `OGS` (main process)

**Files:**
- Modify: `src/main/infrastructure/plugins/plugin-cache-file.ts:73-74`
- Modify: `tests/main/infrastructure/plugins/plugin-cache-file.test.ts:242-243`

- [ ] **Step 1: Update the test first** — `plugin-cache-file.test.ts:242-243`:
```ts
owner: { name: 'OGS' },
description: 'Plugins managed by OGS',
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/main/infrastructure/plugins/plugin-cache-file.test.ts`
Expected: FAIL — source still emits `SDE-AI`.

- [ ] **Step 3: Edit the source** — `plugin-cache-file.ts:73-74`:
```ts
owner: { name: 'OGS' },
description: 'Plugins managed by OGS',
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/main/infrastructure/plugins/plugin-cache-file.test.ts && grep -rn "SDE-AI" src tests`
Expected: PASS; grep returns nothing.

- [ ] **Step 5: Commit**
```bash
git add src/main/infrastructure/plugins/plugin-cache-file.ts tests/main/infrastructure/plugins/plugin-cache-file.test.ts
git commit -m "chore(naming): rename SDE-AI marketplace owner to OGS" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

**Phase 6 gate:** `npm run lint && npm run typecheck && npm test` green; `grep -rn "SDE" src` returns nothing (renderer + the one main-process file).

---

# Phase 7 — `test: update e2e + final gate`

There are **no Playwright visual snapshots** in this repo (the one e2e spec polls on-disk file state — `e2e/language-gi-staleness.spec.ts`). So "update baselines" reduces to updating the e2e navigation path. Note this explicitly in the commit body.

### Task 7.1: Update the e2e navigation

**Files:**
- Modify: `e2e/language-gi-staleness.spec.ts`

- [ ] **Step 1: Update the navigation clicks** to the two-level shell:
  - `:74` `page.click('[data-testid="sidebar-global-instructions"]')` → enter Biblioteca then the sub: `await page.click('[data-testid="nav-biblioteca"]'); await page.click('[data-testid="nav-global-instructions"]');`
  - `:82` `page.click('[data-testid="sidebar-settings"]')` → `await page.click('[data-testid="nav-settings"]');`
  - `:97` same Biblioteca → Global Instructions two-step as `:74`.
  - `:95` `getByRole('button', { name: 'Back' })` — Settings "Back" label is unchanged (English) → keep, OR if Phase 6 translated it, use the new label. (Settings "Back" was **not** in the Phase 6 copy table — keep `'Back'`.)
  - `:84-86` `getByRole('combobox', { name: 'Language' })` + option `'Português (pt-BR)'` — unchanged (Language section stays EN).
  - `:65/:96` `main-screen` selector — unchanged (preserved on the shell root).

- [ ] **Step 2: Build + run e2e**

Run: `npm run test:e2e`
Expected: PASS (1 test). If the new shell needs the area click to settle before the sub appears, add `await page.waitForSelector('[data-testid="nav-global-instructions"]')` between the two clicks.

- [ ] **Step 3: Commit**
```bash
git add e2e/language-gi-staleness.spec.ts
git commit -m "test: update e2e navigation for the two-level shell" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 7.2: Final full gate

- [ ] **Step 1: Run everything**

Run: `npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e`
Expected: all green; production build emits `out/{main,preload,renderer}`.

- [ ] **Step 2: Final acceptance walkthrough (Manual QA)** against spec §15:
  - Cream/Ink + Space Grotesk + JetBrains Mono; **zero Roboto** (`grep -rn fontsource/roboto src` empty), **zero `@mui/icons-material`** in renderer (grep empty).
  - TopNav + SubRail + ⌘K all work; theme persists in `settings.ui.theme` across restart.
  - Chromatic discipline: contained buttons are Ink; "Publicar" uses `color="info"` (Azul); success=verde, warning=âmbar, error=vermelho.
  - Empty/loading/error standardized on every I/O screen.
  - No "SDE" in the UI; chrome PT-BR, technical terms EN.

- [ ] **Step 3: Open the PR** (only when the user asks):
```bash
gh pr create --title "feat: OGS Design System modernization" --body "$(cat <<'EOF'
Adopts the OGS Design System across the renderer: Cream/Ink palette, Space Grotesk + JetBrains Mono, Lucide icons, two-level navigation shell (TopNav + SubRail + ⌘K), and standardized empty/loading/error states. Wires `settings.ui.theme`. Renames the `SDE-AI` marketplace owner to `OGS`.

Seven green commits (see plan: docs/superpowers/plans/2026-06-06-ogs-ui-modernization.md).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

**Phase 7 gate (release gate):** `npm run lint && npm run typecheck && npm test && npm run test:e2e` all green.

---

## Self-review (run against the spec)

**Spec coverage:**
- §3 tokens/palette → Task 1.2/1.3 ✅ · §4 typography/fonts → 1.1/1.3/1.5 ✅ · §5 shape/elevation → 1.3 ✅
- §6 Lucide migration → Phase 3 + 4 (dep removal) ✅ · §7 shell + theme wiring → Phase 4 + Task 1.4 ✅
- §8 ds components → Phase 2 ✅ · §9 screen patterns → Phase 5 ✅ · §10 copy → Task 6.1 ✅
- §11 SDE naming → Task 6.2 (renderer) + 6.3 (main) ✅ · §12 testids/e2e → testid map + Task 4.8/7.1 ✅
- §13 decisions → resolved at top ✅ · §14 commit sequence → Phases 1–7 ✅ · §15 acceptance → Task 7.2 ✅

**Type/name consistency:** `Nav`/`Area`/`LibrarySub`/`PluginsSub` defined in `nav.ts` (4.1) and used identically in TopNav/SubRail/CommandPalette/AppShell/Main; `navTestId` produces the `nav-*` IDs the tests assert; `StatusPill` `testId` prop yields `status-pill-<id>` used by TopNav (`sync`) and tests; `resolveThemeMode`/`createAppTheme`/`theme.ogs` consistent across theme.ts, theme-mode-context, and all `ds/*`.

**Open risks flagged in-plan:** Lucide export-name drift (typecheck catches it; substitution note in Phase 3); `MuiPaper` default `variant: 'outlined'` flattening overlays (addressed in Phase 5 by explicit shadow on drawers/dialogs/palette); coverage thresholds on `screens/**` (guard note in Phase 5).
