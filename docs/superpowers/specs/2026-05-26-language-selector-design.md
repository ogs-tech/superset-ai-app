# Language Selector — Design Spec

## Goal

Add a language selector to the Settings screen that automatically manages a `<language>` block in the Global Instructions body. Controls the language Claude (and other assistants) use to reply.

## Options

| Key      | Label (UI)            | Prompt injected into Global Instructions                                                                                          |
| -------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `off`    | Off                   | _Block removed entirely_                                                                                                          |
| `mirror` | Mirror (same as user) | Reply in the same language the user writes in. Write all code, comments, test descriptions, and technical identifiers in English. |
| `pt-BR`  | Portugues (pt-BR)     | Reply in pt-BR. Write all code, comments, test descriptions, and technical identifiers in English.                                |
| `en`     | English               | Reply in English. Write all code, comments, test descriptions, and technical identifiers in English.                              |
| `es`     | Espanol               | Reply in Spanish. Write all code, comments, test descriptions, and technical identifiers in English.                              |

The "code in English" convention is always present (except `off`).

## Data Model

### Settings type (`src/shared/settings.ts`)

```typescript
export type LanguagePreference = 'off' | 'mirror' | 'pt-BR' | 'en' | 'es';

export interface Settings {
  adapters: { claude: AdapterSettings; copilot: CopilotAdapterSettings };
  linkedRepos: LinkedRepo[];
  ui: UiSettings;
  language: LanguagePreference;
}
```

Default value: `'off'`. Existing `settings.json` files without `language` fall back to this default via `getDefaults()`.

### Managed block format in Global Instruction body

```markdown
<language>
Reply in pt-BR. Write all code, comments, test descriptions, and technical identifiers in English.
</language>
```

Positioned at the **end** of the body. When `off`, the block is removed entirely (no empty tags).

## UI

New `Paper` section in `Settings.tsx`, positioned between "Adapters" and "Linked repos":

- **Heading:** "Language"
- **Description:** "Controls the language prompt in your global instructions."
- **Control:** MUI `Select` with 5 options (Off, Mirror, Portugues, English, Espanol)
- **Info note** (visible when language !== off): "Code, comments, and test descriptions are always written in English."
- **Feedback:** Toast on success; `SyncReportModal` on sync errors.

## Flow

```
User selects "pt-BR" in Settings
    |
    v
Renderer: callIpc('settings.setLanguage', { language: 'pt-BR' })
    |
    v
Main (new IPC handler settings.setLanguage):
  1. settingsService.merge({ language: 'pt-BR' })
  2. globalInstructionService.get('default')
     - If not found: create from template first
  3. newBody = updateLanguageSection(body, 'pt-BR')  <-- pure function
  4. globalInstructionService.save({ globalInstruction: { ...current, body: newBody } })
     - This triggers adapter sync (symlink to ~/.claude/CLAUDE.md)
  5. Return { settings, syncReport }
    |
    v
Renderer: update local settings state; show toast or SyncReportModal
```

### Pure function: `updateLanguageSection(body: string, language: LanguagePreference): string`

Location: `src/main/application/services/language-section.ts`

Logic:

1. Match `<language>` block via regex: `/<language>[\s\S]*?<\/language>/`
2. If `language === 'off'`:
   - Remove the block and any blank lines immediately before it (so the body doesn't end with excess whitespace)
   - Trim trailing whitespace, ensure body ends with a single newline
   - Return cleaned body
3. Build new block: `<language>\n${promptText}\n</language>`
4. If block exists in body: replace it
5. If block does not exist: append to end of body (with preceding blank line)
6. Return new body

This is a pure function with no dependencies — trivial to unit test.

### New IPC method: `settings.setLanguage`

Namespace: `settings`
Params: `{ language: LanguagePreference }`
Returns: `{ settings: Settings; syncReport: SyncResult[] }`

Encapsulates the full operation (settings update + global instruction update) atomically. Avoids partial state from two separate IPC calls.

## Edge Cases

| Case                                                             | Behavior                                                                                                                                       |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Global instruction does not exist                                | Create from template, then add language block                                                                                                  |
| User manually edited the `<language>` block in editor            | Next selector change overwrites it                                                                                                             |
| User manually removed the `<language>` block                     | Selector recreates it on next change                                                                                                           |
| `settings.json` missing `language` field                         | Default to `'off'`, no block added                                                                                                             |
| User changes language while global instruction has unsaved edits | Settings.setLanguage reads persisted body, not editor state — this is fine since language change happens in Settings screen, not in the editor |

## Testing

### Unit tests

- `updateLanguageSection`: insert when no block exists, replace existing block, remove on `off`, handle body with no trailing newline, handle body with multiple blank lines at end

### Service/IPC tests

- `settings.setLanguage` handler: verify settings updated + global instruction body contains correct block + sync triggered
- `settings.setLanguage` with `off`: verify block removed from body

### Renderer tests

- Language Select renders with current value from settings
- Changing selection calls `settings.setLanguage` IPC
- Info note visibility toggles with off/non-off
- Success toast and error modal display correctly

## Files to Create/Modify

### New files

- `src/main/application/services/language-section.ts` — pure function `updateLanguageSection`
- Tests for the above

### Modified files

- `src/shared/settings.ts` — add `LanguagePreference` type, add `language` to `Settings`, update `getDefaults()`
- `src/main/application/services/settings-service.ts` — no changes needed (merge handles new fields)
- `src/main/ipc/registry.ts` — register `settings.setLanguage` handler
- `src/main/ipc/settings-handlers.ts` (or equivalent) — implement `settings.setLanguage` handler
- `src/main/index.ts` — wire dependencies if needed
- `src/renderer/screens/Settings.tsx` — add Language section with Select
- Existing test files updated accordingly

## Out of Scope

- Adding more languages (can be done later by adding to the union type + prompt map)
- Language preference per-repo (only personal/global scope)
- Copilot-specific language instructions (global instruction only syncs to Claude today)
- UI translations for the app itself (this is about assistant reply language)
