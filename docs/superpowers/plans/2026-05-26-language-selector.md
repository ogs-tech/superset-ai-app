# Language Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a language selector to the Settings screen that manages a `<language>` block in the Global Instructions body, controlling the language assistants use to reply.

**Architecture:** New `LanguagePreference` type on Settings + pure function `updateLanguageSection` for Markdown manipulation + dedicated `settings.setLanguage` IPC handler that atomically updates both the settings file and the global instruction body. UI is a MUI `Select` in a new Paper section on Settings.tsx.

**Tech Stack:** TypeScript, Vitest, React, MUI, Electron IPC

---

## File Structure

| Action | File                                                       | Responsibility                                                                        |
| ------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Modify | `src/shared/settings.ts`                                   | Add `LanguagePreference` type, `language` field to `Settings`, update `getDefaults()` |
| Create | `src/main/application/services/language-section.ts`        | Pure function `updateLanguageSection(body, language)` and prompt map                  |
| Create | `tests/main/application/services/language-section.test.ts` | Unit tests for the pure function                                                      |
| Modify | `src/main/ipc/registry.ts`                                 | Register `settings.setLanguage` handler                                               |
| Modify | `src/main/ipc/_validators.ts`                              | Add `asLanguagePreference` validator                                                  |
| Modify | `src/renderer/screens/Settings.tsx`                        | Add Language section with MUI Select                                                  |
| Modify | `tests/renderer/screens/Settings.test.tsx`                 | Tests for language selector UI                                                        |
| Modify | `tests/main/application/services/settings-service.test.ts` | Update `baseSettings` to include `language`                                           |

---

### Task 1: Add `LanguagePreference` type and `language` field to Settings

**Files:**

- Modify: `src/shared/settings.ts:24-57`
- Modify: `tests/main/application/services/settings-service.test.ts:7-14`
- Modify: `tests/renderer/screens/Settings.test.tsx:8-15`

- [ ] **Step 1: Write the failing test — `getDefaults` includes `language: 'off'`**

In `tests/shared/settings.test.ts` (create if it doesn't exist — if it exists, add to it):

```typescript
import { describe, it, expect } from 'vitest';
import { getDefaults } from '../../src/shared/settings.js';

describe('getDefaults', () => {
  it('includes language defaulting to off', () => {
    const defaults = getDefaults();
    expect(defaults.language).toBe('off');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/shared/settings.test.ts -v`
Expected: FAIL — `language` property doesn't exist on returned object

- [ ] **Step 3: Add `LanguagePreference` type and `language` field**

In `src/shared/settings.ts`, add the type alias after the existing `ThemeMode` type (line 1):

```typescript
export type LanguagePreference = 'off' | 'mirror' | 'pt-BR' | 'en' | 'es';
```

Add `language` to the `Settings` interface (after the `ui` field, line 34):

```typescript
export interface Settings {
  adapters: {
    claude: AdapterSettings;
    copilot: CopilotAdapterSettings;
  };
  linkedRepos: LinkedRepo[];
  ui: UiSettings;
  language: LanguagePreference;
}
```

Update `getDefaults()` to include the new field:

```typescript
export function getDefaults(): Settings {
  return {
    adapters: {
      claude: { enabled: true },
      copilot: { enabled: false, exclusiveSkillsWithClaude: false },
    },
    linkedRepos: [],
    ui: { theme: 'system' },
    language: 'off',
  };
}
```

- [ ] **Step 4: Fix all `baseSettings` fixtures across test files**

In `tests/main/application/services/settings-service.test.ts`, update `baseSettings()` (line 7):

```typescript
const baseSettings = (): Settings => ({
  adapters: {
    claude: { enabled: true },
    copilot: { enabled: false, exclusiveSkillsWithClaude: false },
  },
  linkedRepos: [{ id: 'r1', name: 'repo', path: '/repos/r1' }],
  ui: { theme: 'system' },
  language: 'off',
});
```

In `tests/renderer/screens/Settings.test.tsx`, update `baseSettings` (line 8):

```typescript
const baseSettings: Settings = {
  adapters: {
    claude: { enabled: true },
    copilot: { enabled: false, exclusiveSkillsWithClaude: false },
  },
  linkedRepos: [],
  ui: { theme: 'system' },
  language: 'off',
};
```

Search for any other test file that constructs a `Settings` object and add `language: 'off'` to each. Run:

```bash
grep -rn "ui: { theme:" tests/ --include="*.ts" --include="*.tsx"
```

Each match needs `language: 'off'` added to the same object.

- [ ] **Step 5: Run all tests to verify everything passes**

Run: `npx vitest run tests/shared/settings.test.ts tests/main/application/services/settings-service.test.ts tests/renderer/screens/Settings.test.tsx -v`
Expected: ALL PASS

- [ ] **Step 6: Run typecheck to catch any remaining type errors**

Run: `npm run typecheck`
Expected: No errors. If there are errors, they'll be in files constructing a `Settings` object without the new `language` field — add it.

- [ ] **Step 7: Commit**

```bash
git add src/shared/settings.ts tests/shared/settings.test.ts tests/main/application/services/settings-service.test.ts tests/renderer/screens/Settings.test.tsx
git commit -m "feat: add LanguagePreference type and language field to Settings"
```

---

### Task 2: Create pure function `updateLanguageSection`

**Files:**

- Create: `src/main/application/services/language-section.ts`
- Create: `tests/main/application/services/language-section.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/main/application/services/language-section.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  updateLanguageSection,
  LANGUAGE_PROMPTS,
} from '../../../../src/main/application/services/language-section.js';

describe('updateLanguageSection', () => {
  const sampleBody = '# Global instructions\n\nSome content here.\n';

  it('appends a language block when none exists', () => {
    const result = updateLanguageSection(sampleBody, 'pt-BR');
    expect(result).toBe(
      '# Global instructions\n\nSome content here.\n\n<language>\n' +
        LANGUAGE_PROMPTS['pt-BR'] +
        '\n</language>\n',
    );
  });

  it('replaces an existing language block', () => {
    const body = '# Global instructions\n\n<language>\nOld prompt\n</language>\n';
    const result = updateLanguageSection(body, 'en');
    expect(result).toBe(
      '# Global instructions\n\n<language>\n' + LANGUAGE_PROMPTS['en'] + '\n</language>\n',
    );
  });

  it('removes the block entirely when language is off', () => {
    const body = '# Global instructions\n\nContent.\n\n<language>\nSome prompt\n</language>\n';
    const result = updateLanguageSection(body, 'off');
    expect(result).toBe('# Global instructions\n\nContent.\n');
  });

  it('returns body unchanged when off and no block exists', () => {
    const result = updateLanguageSection(sampleBody, 'off');
    expect(result).toBe(sampleBody);
  });

  it('handles body with no trailing newline', () => {
    const body = '# Global instructions\n\nContent.';
    const result = updateLanguageSection(body, 'mirror');
    expect(result).toBe(
      '# Global instructions\n\nContent.\n\n<language>\n' +
        LANGUAGE_PROMPTS['mirror'] +
        '\n</language>\n',
    );
  });

  it('removes excess blank lines before block when removing', () => {
    const body = '# Global instructions\n\nContent.\n\n\n\n<language>\nPrompt\n</language>\n';
    const result = updateLanguageSection(body, 'off');
    expect(result).toBe('# Global instructions\n\nContent.\n');
  });

  it('handles mirror language correctly', () => {
    const result = updateLanguageSection(sampleBody, 'mirror');
    expect(result).toContain('Reply in the same language the user writes in.');
  });

  it('handles es language correctly', () => {
    const result = updateLanguageSection(sampleBody, 'es');
    expect(result).toContain('Reply in Spanish.');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/main/application/services/language-section.test.ts -v`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `updateLanguageSection`**

Create `src/main/application/services/language-section.ts`:

```typescript
import type { LanguagePreference } from '../../../shared/settings.js';

export const LANGUAGE_PROMPTS: Record<Exclude<LanguagePreference, 'off'>, string> = {
  mirror:
    'Reply in the same language the user writes in. Write all code, comments, test descriptions, and technical identifiers in English.',
  'pt-BR':
    'Reply in pt-BR. Write all code, comments, test descriptions, and technical identifiers in English.',
  en: 'Reply in English. Write all code, comments, test descriptions, and technical identifiers in English.',
  es: 'Reply in Spanish. Write all code, comments, test descriptions, and technical identifiers in English.',
};

const LANGUAGE_BLOCK_RE = /\n*<language>[\s\S]*?<\/language>\n?/;

export function updateLanguageSection(body: string, language: LanguagePreference): string {
  if (language === 'off') {
    const cleaned = body.replace(LANGUAGE_BLOCK_RE, '');
    const trimmed = cleaned.replace(/\s+$/, '');
    return trimmed.length === 0 ? '' : trimmed + '\n';
  }

  const block = `<language>\n${LANGUAGE_PROMPTS[language]}\n</language>`;
  const normalized = body.replace(/\s+$/, '');

  if (LANGUAGE_BLOCK_RE.test(body)) {
    const replaced = body.replace(LANGUAGE_BLOCK_RE, '\n\n' + block + '\n');
    return replaced;
  }

  return normalized + '\n\n' + block + '\n';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/main/application/services/language-section.test.ts -v`
Expected: ALL PASS

If any test fails, adjust the regex or formatting logic to satisfy the exact expected output. The key behaviors:

- `off` → remove block + trailing blank lines, ensure single trailing newline
- non-off + no block → append with preceding blank line
- non-off + block exists → replace in-place

- [ ] **Step 5: Commit**

```bash
git add src/main/application/services/language-section.ts tests/main/application/services/language-section.test.ts
git commit -m "feat: add updateLanguageSection pure function"
```

---

### Task 3: Add `asLanguagePreference` validator

**Files:**

- Modify: `src/main/ipc/_validators.ts`

- [ ] **Step 1: Add the validator**

In `src/main/ipc/_validators.ts`, add after the existing `asScope` function:

```typescript
import type { LanguagePreference } from '../../shared/settings.js';

const LANGUAGE_PREFERENCES: readonly LanguagePreference[] = ['off', 'mirror', 'pt-BR', 'en', 'es'];

export function asLanguagePreference(value: unknown, field: string): LanguagePreference {
  if (typeof value !== 'string' || !(LANGUAGE_PREFERENCES as readonly string[]).includes(value)) {
    throw new DomainError(
      'validation',
      `Missing or invalid '${field}' (must be ${LANGUAGE_PREFERENCES.join(' | ')})`,
    );
  }
  return value as LanguagePreference;
}
```

Note: the `DomainError` import already exists at line 1. The `LanguagePreference` import is new — add it at the top of the file.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/main/ipc/_validators.ts
git commit -m "feat: add asLanguagePreference validator"
```

---

### Task 4: Add `settings.setLanguage` IPC handler

**Files:**

- Modify: `src/main/ipc/registry.ts:122-130`

- [ ] **Step 1: Write the failing test**

Create `tests/main/ipc/settings-set-language.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { buildHandlers, type IpcDeps } from '../../../src/main/ipc/registry.js';
import { createDispatcher } from '../../../src/main/ipc/dispatcher.js';
import { getDefaults, type Settings } from '../../../src/shared/settings.js';
import type { GlobalInstruction } from '../../../src/main/application/schemas/global-instruction.js';
import type { SyncResult } from '../../../src/shared/customization.js';

const makeGlobalInstruction = (body: string): GlobalInstruction => ({
  id: 'default' as GlobalInstruction['id'],
  frontmatter: {
    name: 'default',
    type: 'global-instruction',
    description: 'test',
    scopes: ['personal'],
    version: '0.1.0',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  source: { kind: 'workspace' },
  body,
});

const baseDeps = (): IpcDeps => {
  const settings: Settings = { ...getDefaults() };
  const gi = makeGlobalInstruction('# Global instructions\n\nSome content.\n');

  return {
    settingsService: {
      load: vi.fn().mockResolvedValue(settings),
      save: vi.fn().mockResolvedValue(undefined),
      merge: vi.fn().mockImplementation(async (partial) => ({ ...settings, ...partial })),
      getDefaults: vi.fn().mockReturnValue(getDefaults()),
    } as unknown as IpcDeps['settingsService'],
    globalInstructionService: {
      get: vi.fn().mockResolvedValue(gi),
      save: vi.fn().mockResolvedValue({ globalInstruction: gi, syncReport: [] }),
    } as unknown as IpcDeps['globalInstructionService'],
    repoService: {} as IpcDeps['repoService'],
    templateService: {} as IpcDeps['templateService'],
    adapterManager: {} as IpcDeps['adapterManager'],
    dialogPort: {} as IpcDeps['dialogPort'],
    pluginService: {} as IpcDeps['pluginService'],
    credentialStore: {} as IpcDeps['credentialStore'],
    skillService: {} as IpcDeps['skillService'],
    agentService: {} as IpcDeps['agentService'],
    commandService: {} as IpcDeps['commandService'],
    hookService: {} as IpcDeps['hookService'],
    referenceService: {} as IpcDeps['referenceService'],
    marketplaceService: {} as IpcDeps['marketplaceService'],
    appQuit: vi.fn(),
  };
};

describe('settings.setLanguage', () => {
  it('updates settings and injects language block into global instruction', async () => {
    const deps = baseDeps();
    const dispatch = createDispatcher(buildHandlers(deps));

    const result = await dispatch('settings.setLanguage', { language: 'pt-BR' });

    expect(result.ok).toBe(true);

    expect(deps.settingsService.merge).toHaveBeenCalledWith({ language: 'pt-BR' });
    expect(deps.globalInstructionService.save).toHaveBeenCalledWith(
      expect.objectContaining({
        globalInstruction: expect.objectContaining({
          body: expect.stringContaining('<language>'),
        }),
      }),
    );
  });

  it('removes language block when set to off', async () => {
    const deps = baseDeps();
    const giWithBlock = makeGlobalInstruction(
      '# Global instructions\n\n<language>\nReply in pt-BR.\n</language>\n',
    );
    (deps.globalInstructionService.get as ReturnType<typeof vi.fn>).mockResolvedValue(giWithBlock);
    const dispatch = createDispatcher(buildHandlers(deps));

    const result = await dispatch('settings.setLanguage', { language: 'off' });

    expect(result.ok).toBe(true);
    expect(deps.globalInstructionService.save).toHaveBeenCalledWith(
      expect.objectContaining({
        globalInstruction: expect.objectContaining({
          body: expect.not.stringContaining('<language>'),
        }),
      }),
    );
  });

  it('rejects invalid language value', async () => {
    const deps = baseDeps();
    const dispatch = createDispatcher(buildHandlers(deps));

    const result = await dispatch('settings.setLanguage', { language: 'klingon' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('validation');
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/main/ipc/settings-set-language.test.ts -v`
Expected: FAIL — `settings.setLanguage` returns not_found (handler doesn't exist yet)

- [ ] **Step 3: Add the handler to `registry.ts`**

In `src/main/ipc/registry.ts`, add the import at the top (after the existing imports):

```typescript
import { updateLanguageSection } from '../application/services/language-section.js';
import { asLanguagePreference } from './_validators.js';
import { globalInstructionId } from '../domain/global-instruction-id.js';
```

Note: `asObject` and `asString` from `_validators.ts` are already locally defined in registry.ts — use the local ones. Only `asLanguagePreference` needs importing from `_validators.ts`. Also `globalInstructionId` needs importing.

Then add the handler inside `buildHandlers`, after `'settings.merge'` (around line 131):

```typescript
    'settings.setLanguage': async (params) => {
      const raw = asObject(params, 'settings.setLanguage');
      const language = asLanguagePreference(raw['language'], 'language');

      const settings = await settingsService.merge({ language });

      const gi = await globalInstructionService.get(globalInstructionId('default'));
      const newBody = updateLanguageSection(gi.body, language);
      const { syncReport } = await globalInstructionService.save({
        globalInstruction: { ...gi, body: newBody },
      });

      return { settings, syncReport };
    },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/main/ipc/settings-set-language.test.ts -v`
Expected: ALL PASS

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add src/main/ipc/registry.ts src/main/ipc/_validators.ts tests/main/ipc/settings-set-language.test.ts
git commit -m "feat: add settings.setLanguage IPC handler"
```

---

### Task 5: Add Language section to Settings UI

**Files:**

- Modify: `src/renderer/screens/Settings.tsx:1-517`
- Modify: `tests/renderer/screens/Settings.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add to `tests/renderer/screens/Settings.test.tsx`:

```typescript
import type { LanguagePreference, Settings } from '../../../src/shared/settings.js';
```

Update the import on line 6 to include `LanguagePreference`.

Then update `setupRoute` to also handle `settings.setLanguage`:

```typescript
const setupRoute = (initial: Settings = baseSettings, overrides: Record<string, unknown> = {}) => {
  call.mockImplementation((method: string) => {
    if (method in overrides) return Promise.resolve(overrides[method]);
    if (method === 'settings.get') return Promise.resolve(ok(initial));
    if (method === 'repo.list') return Promise.resolve(ok([]));
    if (method === 'settings.merge') return Promise.resolve(ok(initial));
    if (method === 'settings.setLanguage')
      return Promise.resolve(ok({ settings: initial, syncReport: [] }));
    if (method === 'adapter.setEnabled') return Promise.resolve(ok({ syncReport: [] }));
    if (method === 'adapter.countDestinations') return Promise.resolve(ok({ count: 0 }));
    if (method === 'adapter.syncAll' || method === 'adapter.removeAll')
      return Promise.resolve(ok([]));
    return Promise.resolve(ok(undefined));
  });
};
```

Then add the test block:

```typescript
describe('<Settings> — language selector', () => {
  it('renders the language select with current value from settings', async () => {
    setupRoute({ ...baseSettings, language: 'pt-BR' });
    render(<SettingsScreen />);

    const select = await screen.findByLabelText('Language');
    expect(select).toHaveTextContent('Português (pt-BR)');
  });

  it('defaults to Off when language is off', async () => {
    setupRoute();
    render(<SettingsScreen />);

    const select = await screen.findByLabelText('Language');
    expect(select).toHaveTextContent('Off');
  });

  it('calls settings.setLanguage when selection changes', async () => {
    const user = userEvent.setup();
    setupRoute();
    render(<SettingsScreen />);

    const select = await screen.findByLabelText('Language');
    await user.click(select);
    const option = await screen.findByRole('option', { name: 'English' });
    await user.click(option);

    await waitFor(() =>
      expect(call).toHaveBeenCalledWith(
        'settings.setLanguage',
        expect.objectContaining({ language: 'en' }),
      ),
    );
  });

  it('shows info note when language is not off', async () => {
    setupRoute({ ...baseSettings, language: 'en' });
    render(<SettingsScreen />);

    await waitFor(() =>
      expect(
        screen.getByText(/code, comments, and test descriptions are always written in English/i),
      ).toBeInTheDocument(),
    );
  });

  it('hides info note when language is off', async () => {
    setupRoute();
    render(<SettingsScreen />);

    await screen.findByLabelText('Language');

    expect(
      screen.queryByText(/code, comments, and test descriptions are always written in English/i),
    ).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/renderer/screens/Settings.test.tsx -v`
Expected: FAIL — no element with label "Language" found

- [ ] **Step 3: Add Language section to Settings.tsx**

In `src/renderer/screens/Settings.tsx`, add these imports at the top:

```typescript
import {
  // ... existing imports ...
  Alert,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  // ... rest of existing imports ...
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
```

Note: `Alert` is already imported. Add `FormControl`, `InputLabel`, `MenuItem`, `Select` to the existing MUI import if not already present. Check what's already imported and add only what's missing. `Select` and `MenuItem` are new. `FormControl` and `InputLabel` are new.

Add the import for the type:

```typescript
import type {
  LanguagePreference,
  LinkedRepoView,
  Settings as SettingsModel,
} from '../../shared/settings.js';
```

Add the language options constant outside the component:

```typescript
const LANGUAGE_OPTIONS: { value: LanguagePreference; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'mirror', label: 'Mirror (same as user)' },
  { value: 'pt-BR', label: 'Português (pt-BR)' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
];
```

Add a state variable and handler inside the component:

```typescript
const [languageLoading, setLanguageLoading] = useState(false);

const handleLanguageChange = async (language: LanguagePreference): Promise<void> => {
  setLanguageLoading(true);
  try {
    const result = await callIpc<{ settings: SettingsModel; syncReport: SyncResult[] }>(
      'settings.setLanguage',
      { language },
    );
    setSettings(result.settings);
    if (result.syncReport.some((e) => e.status !== 'ok')) {
      setSyncReport(result.syncReport);
    }
  } finally {
    setLanguageLoading(false);
  }
};
```

Add the UI section in the JSX, between the Adapters `Paper` and the Linked repos `Paper` (after line 299):

```tsx
<Paper component="section" variant="outlined" sx={{ p: 3, mb: 3 }}>
  <Typography variant="h6" component="h2" gutterBottom>
    Language
  </Typography>
  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
    Controls the language prompt in your global instructions.
  </Typography>
  <FormControl size="small" sx={{ minWidth: 240 }}>
    <InputLabel id="language-select-label">Language</InputLabel>
    <Select
      labelId="language-select-label"
      label="Language"
      value={settings.language}
      disabled={languageLoading}
      onChange={(e) => void handleLanguageChange(e.target.value as LanguagePreference)}
    >
      {LANGUAGE_OPTIONS.map((opt) => (
        <MenuItem key={opt.value} value={opt.value}>
          {opt.label}
        </MenuItem>
      ))}
    </Select>
  </FormControl>
  {settings.language !== 'off' && (
    <Stack
      direction="row"
      sx={{ mt: 1.5, gap: 0.5, alignItems: 'center', color: 'text.secondary' }}
    >
      <InfoOutlinedIcon fontSize="small" />
      <Typography variant="caption">
        Code, comments, and test descriptions are always written in English.
      </Typography>
    </Stack>
  )}
</Paper>
```

- [ ] **Step 4: Run the renderer tests to verify they pass**

Run: `npx vitest run tests/renderer/screens/Settings.test.tsx -v`
Expected: ALL PASS

If tests fail due to MUI Select rendering (e.g., `getByLabelText` not finding the select), adjust the test query. MUI Select renders a hidden `<input>` — use `findByLabelText('Language')` which should find it via the `InputLabel`.

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: ALL PASS

- [ ] **Step 6: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/renderer/screens/Settings.tsx tests/renderer/screens/Settings.test.tsx
git commit -m "feat: add language selector UI to Settings screen"
```

---

### Task 6: Visual verification

**Files:** None (manual check)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Verify in the browser/Electron window**

Open the Settings screen and verify:

1. The Language section appears between Adapters and Linked repos
2. The select defaults to "Off"
3. Selecting "Português (pt-BR)" triggers the IPC call
4. The info note appears when any language other than Off is selected
5. The info note disappears when Off is selected
6. After selecting a language, open the Global Instructions editor and confirm the `<language>` block is present at the end of the body
7. Selecting "Off" removes the block

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 4: Final commit if any adjustments were needed**

Only commit if visual testing required fixes. If everything worked, skip this step.
