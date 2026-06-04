# Entity Detail Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace full-screen detail/view pages opened from `EntityDataGrid` row clicks with a right-anchored MUI Drawer, so users keep list context while inspecting items.

**Architecture:** Each screen owns its drawer state (no API change to `EntityDataGrid`). A small reusable `DetailDrawer` provides consistent chrome (header with title, badges, close button + content area). Three screens are converted in this plan: `MarketplaceList` (already had row click → full-screen `MarketplaceDetail`), `TemplateList` (currently a "View" row action → full-screen `EntityViewer`), and `CustomizationListScreen` (used by skills/agents/commands/references/global-instructions; same View-action pattern). Editor flows (`TemplateEditor`, `CustomizationEditor`) stay full-screen — out of scope.

**Tech Stack:** React 19, MUI 9 (`Drawer`, `Box`, `Stack`, `Typography`, `IconButton`), TanStack Query, Vitest + Testing Library.

---

## File Structure

**New files:**
- `src/renderer/components/DetailDrawer.tsx` — generic right-anchored drawer with header/close button, used by all three flows
- `src/renderer/screens/templates/TemplateViewDrawer.tsx` — view-only content for a `Template` (description + body markdown)
- `src/renderer/components/CustomizationViewDrawer.tsx` — view-only content for a `CustomizationListItem` (description + body markdown + plugin notice)
- `tests/renderer/components/DetailDrawer.test.tsx`
- `tests/renderer/screens/templates/TemplateViewDrawer.test.tsx`
- `tests/renderer/components/CustomizationViewDrawer.test.tsx`
- `tests/renderer/screens/templates/TemplateList.test.tsx`
- `tests/renderer/components/CustomizationListScreen.test.tsx`

**Modified files:**
- `src/renderer/screens/marketplaces/MarketplaceDetail.tsx` — drop outer `Container`/back button so the drawer is the chrome (extract content; render as embedded)
- `src/renderer/screens/marketplaces/MarketplaceList.tsx` — replace "early-return full-screen" pattern with drawer rendering
- `src/renderer/screens/templates/TemplateList.tsx` — add `onRowClick` → drawer; remove the "View" row action
- `src/renderer/components/CustomizationListScreen.tsx` — add `onRowClick` → drawer; remove the "View" row action
- `tests/renderer/screens/marketplaces/MarketplaceList.test.tsx` — update to assert drawer-based interaction
- `tests/renderer/screens/marketplaces/MarketplaceDetail.test.tsx` — update for embedded layout (no Container/back button)

**Untouched (out of scope for this plan):**
- `EntityDataGrid` types & implementation (the existing `onRowClick` prop is sufficient)
- `PluginList`, `HookList`, `StarterPackScreen` (no current detail UX)
- `TemplateEditor`, `CustomizationEditor` (editor flows stay full-screen)

---

## Task 1: Reusable `DetailDrawer` (TDD)

Reusable right-anchored drawer with header (title, optional subtitle, optional badges, close button) + scrollable content area. All three screens consume this — same look & feel everywhere.

**Files:**
- Create: `src/renderer/components/DetailDrawer.tsx`
- Test: `tests/renderer/components/DetailDrawer.test.tsx`

- [ ] **Step 1.1: Write the failing test**

Create `tests/renderer/components/DetailDrawer.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DetailDrawer } from '../../../src/renderer/components/DetailDrawer.js';

describe('<DetailDrawer>', () => {
  it('does not render content when closed', () => {
    render(
      <DetailDrawer
        open={false}
        onClose={vi.fn()}
        title="Hello"
        testId="x"
      >
        <div>body</div>
      </DetailDrawer>,
    );
    expect(screen.queryByText('body')).not.toBeInTheDocument();
  });

  it('renders title, subtitle and content when open', () => {
    render(
      <DetailDrawer
        open
        onClose={vi.fn()}
        title="Hello"
        subtitle="world"
        testId="x"
      >
        <div>body</div>
      </DetailDrawer>,
    );
    expect(screen.getByTestId('detail-drawer-x')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hello' })).toBeInTheDocument();
    expect(screen.getByText('world')).toBeInTheDocument();
    expect(screen.getByText('body')).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn();
    render(
      <DetailDrawer open onClose={onClose} title="Hello" testId="x">
        <div>body</div>
      </DetailDrawer>,
    );
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 1.2: Run test to verify it fails**

Run: `npx vitest run tests/renderer/components/DetailDrawer.test.tsx`
Expected: FAIL — module `DetailDrawer.js` does not exist.

- [ ] **Step 1.3: Implement `DetailDrawer`**

Create `src/renderer/components/DetailDrawer.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Box, Drawer, IconButton, Stack, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

interface DetailDrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  badges?: ReactNode;
  children: ReactNode;
  testId: string;
  width?: number | string;
}

export function DetailDrawer({
  open,
  onClose,
  title,
  subtitle,
  badges,
  children,
  testId,
  width = 560,
}: DetailDrawerProps): React.ReactElement {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: { width: { xs: '100%', sm: width } },
          'data-testid': `detail-drawer-${testId}`,
        },
      }}
    >
      <Stack
        direction="row"
        sx={{
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 1,
          px: 2,
          py: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: 'center', flexWrap: 'wrap' }}
          >
            <Typography variant="h6" component="h2" sx={{ wordBreak: 'break-word' }}>
              {title}
            </Typography>
            {badges}
          </Stack>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        <IconButton aria-label="Close" onClick={onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>{children}</Box>
    </Drawer>
  );
}
```

- [ ] **Step 1.4: Run test to verify it passes**

Run: `npx vitest run tests/renderer/components/DetailDrawer.test.tsx`
Expected: PASS — all 3 tests green.

- [ ] **Step 1.5: Commit**

```bash
git add src/renderer/components/DetailDrawer.tsx tests/renderer/components/DetailDrawer.test.tsx
git commit -m "feat: add DetailDrawer wrapper for entity detail views"
```

---

## Task 2: Convert `MarketplaceDetail` to drawer-embedded layout

`MarketplaceDetail` today renders its own `<Container>` and a back button. The drawer provides that chrome now, so we strip the outer page chrome and let the parent (the drawer) wrap the content.

**Files:**
- Modify: `src/renderer/screens/marketplaces/MarketplaceDetail.tsx`
- Test: `tests/renderer/screens/marketplaces/MarketplaceDetail.test.tsx`

- [ ] **Step 2.1: Update the failing test for embedded layout**

Open `tests/renderer/screens/marketplaces/MarketplaceDetail.test.tsx` and replace the assertions that check for the page chrome (back button / `marketplace-detail` `<Container>`) with assertions that the content renders without that chrome. Read the current test first; then update it so:

1. Tests no longer pass an `onBack` prop (it is being removed).
2. Tests no longer assert on a back button.
3. Tests still assert that the marketplace name, description, and plugins list render.

If the existing test file references `onBack`, change every render to drop that prop. Add this assertion to the "renders marketplace info" test:

```tsx
expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument();
```

- [ ] **Step 2.2: Run test to verify it fails**

Run: `npx vitest run tests/renderer/screens/marketplaces/MarketplaceDetail.test.tsx`
Expected: FAIL — back button still rendered (or `onBack` type error if you removed prop usage from the test before changing the source).

- [ ] **Step 2.3: Refactor `MarketplaceDetail` — drop `onBack` and outer `Container`**

In `src/renderer/screens/marketplaces/MarketplaceDetail.tsx`:

1. Remove the `onBack` field from the `MarketplaceDetailProps` interface (and all references):

```tsx
interface MarketplaceDetailProps {
  marketplace: MarketplaceSummary;
}
```

2. Remove the import for `ArrowBackIcon` and remove `Container` from the `@mui/material` import list (replace with `Box` if not already imported).

3. Replace the JSX `return` block — change the outer `<Container component="main" data-testid="marketplace-detail" maxWidth="md" sx={{ py: 4 }}>...</Container>` to `<Box data-testid="marketplace-detail">...</Box>` and **delete the `<Button variant="text" startIcon={<ArrowBackIcon />} onClick={onBack}>Back</Button>`** entirely.

4. Adjust the header `<Stack direction="row">` so it no longer reserves space for the (now-removed) back button — change `sx={{ mb: 3, justifyContent: 'space-between', alignItems: 'center' }}` to `sx={{ mb: 2, alignItems: 'flex-start' }}` and remove the `<Box>...</Box>` wrapper around the title block (or keep it; either works — the point is the back button is gone).

5. Reduce vertical padding since the drawer already provides padding: any remaining `py: 4` / `py: 3` on the root container should be removed (the root is now a `<Box>` without padding — the drawer's `p: 2` handles spacing).

The refactored signature and shell:

```tsx
export function MarketplaceDetail({
  marketplace,
}: MarketplaceDetailProps): React.ReactElement {
  // ... (state, effects, handlers unchanged) ...
  return (
    <Box data-testid="marketplace-detail">
      <Stack direction="row" sx={{ mb: 2, alignItems: 'flex-start' }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography variant="h5" component="h2">
            {marketplace.manifest?.name ?? marketplace.id}
          </Typography>
          <Chip
            label={isLocal ? 'local' : label.badge}
            size="small"
            color={isLocal ? 'default' : 'primary'}
            variant={isLocal ? 'outlined' : 'filled'}
          />
          {isOfficial && (
            <Chip
              icon={<VerifiedIcon sx={{ fontSize: 14 }} />}
              label="official"
              size="small"
              color="primary"
              data-testid="marketplace-official-badge"
            />
          )}
        </Stack>
      </Stack>
      {marketplace.manifest?.description && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {marketplace.manifest.description}
        </Typography>
      )}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        {label.href ? (
          <Link href={label.href} target="_blank" rel="noopener" underline="hover">
            {label.detail}
          </Link>
        ) : (
          label.detail
        )}
      </Typography>

      {!marketplace.manifest && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Marketplace manifest could not be loaded. Try refreshing the marketplace.
        </Alert>
      )}

      <EntityDataGrid<MarketplacePlugin>
        entity={entity}
        data={plugins}
        cardSlots={cardSlots}
        searchPlaceholder="Search plugins"
        emptyState={
          {/* keep the existing emptyState exactly as-is */}
        }
      />

      {/* Keep PluginInstallPreviewDialog and Toast renders exactly as-is */}
    </Box>
  );
}
```

> **Important:** the bodies of the `entity`, `cardSlots`, install handlers, `emptyState`, `<PluginInstallPreviewDialog>`, and `<Toast>` are unchanged — only the outer chrome (`Container`, back button) is removed and the title becomes `h5/h2` (smaller, drawer-appropriate).

- [ ] **Step 2.4: Run test to verify it passes**

Run: `npx vitest run tests/renderer/screens/marketplaces/MarketplaceDetail.test.tsx`
Expected: PASS.

- [ ] **Step 2.5: Commit**

```bash
git add src/renderer/screens/marketplaces/MarketplaceDetail.tsx tests/renderer/screens/marketplaces/MarketplaceDetail.test.tsx
git commit -m "refactor: drop page chrome from MarketplaceDetail for drawer embedding"
```

---

## Task 3: Wire `MarketplaceList` row click to drawer (TDD)

Replace `if (selected) return <MarketplaceDetail />` with a sibling `<DetailDrawer>` that renders `<MarketplaceDetail>` when `selected` is set.

**Files:**
- Modify: `src/renderer/screens/marketplaces/MarketplaceList.tsx`
- Test: `tests/renderer/screens/marketplaces/MarketplaceList.test.tsx`

- [ ] **Step 3.1: Write the failing test**

Append to `tests/renderer/screens/marketplaces/MarketplaceList.test.tsx`:

```tsx
it('opens marketplace detail drawer when a card is clicked', async () => {
  call.mockImplementation((method: string) => {
    if (method === 'marketplace.list')
      return Promise.resolve(
        ok([
          {
            id: 'cpo',
            source: { kind: 'directory', path: '/tmp/cpo' },
            manifest: {
              name: 'Catalog',
              description: 'desc',
              plugins: [{ name: 'p1', description: 'plugin 1', source: 'a' }],
            },
          },
        ]),
      );
    if (method === 'plugin.list') return Promise.resolve(ok([]));
    return Promise.resolve(ok(undefined));
  });
  const user = userEvent.setup();
  renderWithQuery(<MarketplaceList />);

  // List remains on screen
  const card = await screen.findByTestId('entity-grid-card-marketplace-cpo');
  await user.click(card);

  // Drawer opens; list still mounted
  expect(await screen.findByTestId('detail-drawer-marketplace')).toBeInTheDocument();
  expect(screen.getByTestId('marketplace-list')).toBeInTheDocument();
  expect(screen.getByTestId('marketplace-detail')).toBeInTheDocument();

  // Close drawer
  await user.click(screen.getByRole('button', { name: /close/i }));
  expect(screen.queryByTestId('marketplace-detail')).not.toBeInTheDocument();
});
```

- [ ] **Step 3.2: Run test to verify it fails**

Run: `npx vitest run tests/renderer/screens/marketplaces/MarketplaceList.test.tsx`
Expected: FAIL — `detail-drawer-marketplace` not found (today the click still triggers full-screen replacement, and `MarketplaceDetail` no longer accepts `onBack` after Task 2 — so this test won't pass until we wire up the drawer).

- [ ] **Step 3.3: Replace early-return with drawer rendering**

In `src/renderer/screens/marketplaces/MarketplaceList.tsx`:

1. Add to the imports:

```tsx
import { DetailDrawer } from '../../components/DetailDrawer.js';
```

2. **Delete** the entire early-return block:

```tsx
if (selected) {
  return (
    <MarketplaceDetail
      marketplace={selected}
      onBack={() => {
        setSelected(null);
        void qc.invalidateQueries({ queryKey: MARKETPLACES_QUERY_KEY });
      }}
    />
  );
}
```

3. Inside the existing main `return (...)` block, just **before** the closing `</Container>`, add:

```tsx
<DetailDrawer
  open={selected !== null}
  onClose={() => {
    setSelected(null);
    void qc.invalidateQueries({ queryKey: MARKETPLACES_QUERY_KEY });
  }}
  title={selected?.manifest?.name ?? selected?.id ?? ''}
  testId="marketplace"
>
  {selected && <MarketplaceDetail marketplace={selected} />}
</DetailDrawer>
```

> **Note on data freshness:** the original early-return invalidated the query in `onBack` so reopening the list reflected newly-installed plugins. We preserve that behavior in `onClose`.

> **Note on conditional child:** rendering `<MarketplaceDetail>` only when `selected` is non-null prevents stale state when the drawer is closed — the component re-mounts (and re-runs its `plugin.list` effect) every time the user opens a different marketplace.

- [ ] **Step 3.4: Run test to verify it passes**

Run: `npx vitest run tests/renderer/screens/marketplaces/MarketplaceList.test.tsx`
Expected: PASS — all tests, including the new drawer test.

- [ ] **Step 3.5: Update existing tests that asserted full-screen behavior**

If any existing test in `MarketplaceList.test.tsx` asserts on going to a full-screen detail (e.g. checks the "Back" button or expects the list to disappear after clicking a card), update it to the drawer model: list stays visible, drawer appears.

Run the full file again: `npx vitest run tests/renderer/screens/marketplaces/MarketplaceList.test.tsx`
Expected: all PASS.

- [ ] **Step 3.6: Commit**

```bash
git add src/renderer/screens/marketplaces/MarketplaceList.tsx tests/renderer/screens/marketplaces/MarketplaceList.test.tsx
git commit -m "feat: open marketplace detail in drawer instead of full-screen replacement"
```

---

## Task 4: `TemplateViewDrawer` view-only content (TDD)

Reusable view content for templates: shows description and the markdown body, plus a "Read-only" notice for plugin-sourced templates (currently templates only have workspace source — but we keep the contract symmetric with customizations).

**Files:**
- Create: `src/renderer/screens/templates/TemplateViewDrawer.tsx`
- Test: `tests/renderer/screens/templates/TemplateViewDrawer.test.tsx`

- [ ] **Step 4.1: Write the failing test**

Create `tests/renderer/screens/templates/TemplateViewDrawer.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TemplateViewDrawer } from '../../../../src/renderer/screens/templates/TemplateViewDrawer.js';
import type { Template } from '../../../../src/shared/template.js';

const sample: Template = {
  id: 'skill-starter',
  frontmatter: {
    name: 'Skill Starter',
    description: 'Starting point for skills',
    targetType: 'skill',
    version: '1.0.0',
    scopes: ['personal'],
  },
  body: '# Body\n\nMarkdown content here.',
};

describe('<TemplateViewDrawer>', () => {
  it('does not render when template is null', () => {
    render(
      <TemplateViewDrawer template={null} onClose={vi.fn()} onEdit={vi.fn()} />,
    );
    expect(screen.queryByTestId(/detail-drawer/i)).not.toBeInTheDocument();
  });

  it('renders template name, description and body', () => {
    render(
      <TemplateViewDrawer
        template={sample}
        onClose={vi.fn()}
        onEdit={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Skill Starter' })).toBeInTheDocument();
    expect(screen.getByText('Starting point for skills')).toBeInTheDocument();
    expect(screen.getByText('Markdown content here.')).toBeInTheDocument();
  });

  it('calls onEdit when the Edit button is clicked', async () => {
    const onEdit = vi.fn();
    render(
      <TemplateViewDrawer
        template={sample}
        onClose={vi.fn()}
        onEdit={onEdit}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledWith(sample);
  });
});
```

- [ ] **Step 4.2: Run test to verify it fails**

Run: `npx vitest run tests/renderer/screens/templates/TemplateViewDrawer.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 4.3: Implement `TemplateViewDrawer`**

Create `src/renderer/screens/templates/TemplateViewDrawer.tsx`:

```tsx
import { Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import ReactMarkdown from 'react-markdown';
import { DetailDrawer } from '../../components/DetailDrawer.js';
import type { Template } from '../../../shared/template.js';

interface TemplateViewDrawerProps {
  template: Template | null;
  onClose: () => void;
  onEdit: (template: Template) => void;
}

export function TemplateViewDrawer({
  template,
  onClose,
  onEdit,
}: TemplateViewDrawerProps): React.ReactElement {
  return (
    <DetailDrawer
      open={template !== null}
      onClose={onClose}
      title={template?.frontmatter.name ?? ''}
      subtitle={template?.frontmatter.description}
      badges={
        template ? (
          <>
            <Chip
              size="small"
              variant="outlined"
              label={template.frontmatter.targetType}
            />
            <Chip
              size="small"
              variant="outlined"
              label={`v${template.frontmatter.version}`}
            />
          </>
        ) : undefined
      }
      testId="template"
    >
      {template && (
        <Stack spacing={2}>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<EditIcon fontSize="small" />}
              onClick={() => onEdit(template)}
            >
              Edit
            </Button>
          </Stack>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Body
            </Typography>
            <Box sx={{ mt: 1, '& p': { my: 0.5 } }}>
              <ReactMarkdown>{template.body}</ReactMarkdown>
            </Box>
          </Paper>
        </Stack>
      )}
    </DetailDrawer>
  );
}
```

- [ ] **Step 4.4: Run test to verify it passes**

Run: `npx vitest run tests/renderer/screens/templates/TemplateViewDrawer.test.tsx`
Expected: PASS.

- [ ] **Step 4.5: Commit**

```bash
git add src/renderer/screens/templates/TemplateViewDrawer.tsx tests/renderer/screens/templates/TemplateViewDrawer.test.tsx
git commit -m "feat: add TemplateViewDrawer for read-only template preview"
```

---

## Task 5: Wire `TemplateList` row click → drawer; remove "View" action (TDD)

Clicking a template row opens `TemplateViewDrawer`. The "Edit" button inside the drawer closes the drawer and opens the existing full-screen `TemplateEditor`. The redundant "View" row action is removed (replaced by row click).

**Files:**
- Modify: `src/renderer/screens/templates/TemplateList.tsx`
- Test: `tests/renderer/screens/templates/TemplateList.test.tsx` (new)

- [ ] **Step 5.1: Write the failing test**

Create `tests/renderer/screens/templates/TemplateList.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TemplateList } from '../../../../src/renderer/screens/templates/TemplateList.js';
import { mockApi, ok, renderWithQuery, type CallSpy } from '../../test-utils.js';

let call: CallSpy;

beforeEach(() => {
  call = mockApi();
});

const sampleTemplate = {
  id: 't1',
  frontmatter: {
    name: 'My Template',
    description: 'desc',
    targetType: 'skill' as const,
    version: '1.0.0',
    scopes: ['personal'],
  },
  body: 'Hello body',
};

describe('<TemplateList>', () => {
  it('opens a drawer when a template card is clicked', async () => {
    call.mockImplementation((method: string) => {
      if (method === 'template.list') return Promise.resolve(ok([sampleTemplate]));
      return Promise.resolve(ok(undefined));
    });
    const user = userEvent.setup();
    renderWithQuery(<TemplateList />);

    const card = await screen.findByTestId('entity-grid-card-template-t1');
    await user.click(card);

    expect(await screen.findByTestId('detail-drawer-template')).toBeInTheDocument();
    expect(screen.getByText('Hello body')).toBeInTheDocument();
  });

  it('does not show the "View" row action (replaced by row click)', async () => {
    call.mockImplementation((method: string) => {
      if (method === 'template.list') return Promise.resolve(ok([sampleTemplate]));
      return Promise.resolve(ok(undefined));
    });
    renderWithQuery(<TemplateList />);
    await screen.findByTestId('entity-grid-card-template-t1');
    // The row's action buttons render with aria-label set to the action label
    expect(screen.queryByRole('button', { name: 'View' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 5.2: Run test to verify it fails**

Run: `npx vitest run tests/renderer/screens/templates/TemplateList.test.tsx`
Expected: FAIL — drawer not wired up; "View" action still present.

- [ ] **Step 5.3: Update `TemplateList` to use the drawer and drop the View action**

In `src/renderer/screens/templates/TemplateList.tsx`:

1. Add to imports:

```tsx
import { TemplateViewDrawer } from './TemplateViewDrawer.js';
```

2. Remove the now-unused imports `VisibilityIcon` and `EntityViewer`.

3. **Keep** the existing `viewing` state declaration (`const [viewing, setViewing] = useState<Template | null>(null);`) — its semantics change from "full-screen view" to "drawer-open template", but the type is identical.

4. **Delete** the early-return block entirely:

```tsx
if (viewing) {
  return (
    <EntityViewer
      entity={{
        frontmatter: viewing.frontmatter as unknown as {
          name: string;
        } & Record<string, unknown>,
        body: viewing.body,
        source: { kind: 'workspace' },
      }}
      title="Templates"
      onBack={() => setViewing(null)}
    />
  );
}
```

5. **Remove** the `View` entry from the `actions` array. The `actions` array becomes:

```tsx
const actions: RowAction<Template>[] = [
  {
    label: 'Edit',
    icon: <EditIcon fontSize="small" />,
    onClick: (item) => setEditor({ kind: 'edit', template: item }),
  },
  {
    label: 'Delete',
    icon: <DeleteOutlineIcon fontSize="small" />,
    variant: 'destructive',
    onClick: (item) => setConfirmDelete(item),
  },
];
```

6. Add `onRowClick` to the `<EntityDataGrid<Template>>` JSX (between `actions` and `searchPlaceholder`):

```tsx
onRowClick={(item) => setViewing(item)}
```

7. Just **before** the closing `</Container>` (after the delete confirmation `<Dialog>` and before `<Toast>`), render:

```tsx
<TemplateViewDrawer
  template={viewing}
  onClose={() => setViewing(null)}
  onEdit={(item) => {
    setViewing(null);
    setEditor({ kind: 'edit', template: item });
  }}
/>
```

- [ ] **Step 5.4: Run tests to verify they pass**

Run: `npx vitest run tests/renderer/screens/templates/TemplateList.test.tsx`
Expected: PASS.

- [ ] **Step 5.5: Run typecheck to confirm no broken imports**

Run: `npm run typecheck`
Expected: PASS — `EntityViewer` import is no longer used in `TemplateList`, no dangling references.

- [ ] **Step 5.6: Commit**

```bash
git add src/renderer/screens/templates/TemplateList.tsx tests/renderer/screens/templates/TemplateList.test.tsx
git commit -m "feat: open template details in drawer on row click"
```

---

## Task 6: `CustomizationViewDrawer` view-only content (TDD)

Mirrors `TemplateViewDrawer` but for `CustomizationListItem` (used by skills/agents/commands/refs/global-instructions). Includes the read-only notice for plugin-sourced items, and an Edit button that only appears for workspace items.

**Files:**
- Create: `src/renderer/components/CustomizationViewDrawer.tsx`
- Test: `tests/renderer/components/CustomizationViewDrawer.test.tsx`

- [ ] **Step 6.1: Write the failing test**

Create `tests/renderer/components/CustomizationViewDrawer.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomizationViewDrawer } from '../../../src/renderer/components/CustomizationViewDrawer.js';
import type { CustomizationListItem } from '../../../src/renderer/hooks/use-customization-list.js';

const workspace: CustomizationListItem = {
  id: 'skill-a',
  frontmatter: {
    name: 'Skill A',
    description: 'a skill',
  } as CustomizationListItem['frontmatter'],
  body: '# Skill body',
  source: { kind: 'workspace' },
};

const plugin: CustomizationListItem = {
  id: 'skill-b',
  frontmatter: {
    name: 'Skill B',
    description: 'plugin-provided',
  } as CustomizationListItem['frontmatter'],
  body: '# Plugin body',
  source: { kind: 'plugin', pluginId: 'my-plugin' },
};

describe('<CustomizationViewDrawer>', () => {
  it('does not render when entity is null', () => {
    render(
      <CustomizationViewDrawer
        entity={null}
        onClose={vi.fn()}
        onEdit={vi.fn()}
      />,
    );
    expect(screen.queryByTestId(/detail-drawer/i)).not.toBeInTheDocument();
  });

  it('renders Edit button for workspace items', async () => {
    const onEdit = vi.fn();
    render(
      <CustomizationViewDrawer
        entity={workspace}
        onClose={vi.fn()}
        onEdit={onEdit}
      />,
    );
    expect(screen.getByText('Skill body')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledWith(workspace);
  });

  it('hides Edit button and shows read-only notice for plugin items', () => {
    render(
      <CustomizationViewDrawer
        entity={plugin}
        onClose={vi.fn()}
        onEdit={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.getByText(/my-plugin/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 6.2: Run test to verify it fails**

Run: `npx vitest run tests/renderer/components/CustomizationViewDrawer.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 6.3: Implement `CustomizationViewDrawer`**

Create `src/renderer/components/CustomizationViewDrawer.tsx`:

```tsx
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import ReactMarkdown from 'react-markdown';
import { DetailDrawer } from './DetailDrawer.js';
import { ReadOnlyNotice } from './ReadOnlyNotice.js';
import { PluginOriginBadge } from './PluginOriginBadge.js';
import type { CustomizationListItem } from '../hooks/use-customization-list.js';

interface CustomizationViewDrawerProps {
  entity: CustomizationListItem | null;
  onClose: () => void;
  onEdit: (entity: CustomizationListItem) => void;
}

export function CustomizationViewDrawer({
  entity,
  onClose,
  onEdit,
}: CustomizationViewDrawerProps): React.ReactElement {
  const isWorkspace = entity?.source.kind === 'workspace';
  const pluginId =
    entity?.source.kind === 'plugin' ? entity.source.pluginId : null;

  return (
    <DetailDrawer
      open={entity !== null}
      onClose={onClose}
      title={entity?.frontmatter.name ?? ''}
      subtitle={
        typeof entity?.frontmatter.description === 'string'
          ? entity.frontmatter.description
          : undefined
      }
      badges={
        pluginId ? <PluginOriginBadge pluginId={pluginId} /> : undefined
      }
      testId="customization"
    >
      {entity && (
        <Stack spacing={2}>
          {pluginId && <ReadOnlyNotice pluginId={pluginId} />}
          {isWorkspace && (
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<EditIcon fontSize="small" />}
                onClick={() => onEdit(entity)}
              >
                Edit
              </Button>
            </Stack>
          )}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Body
            </Typography>
            <Box sx={{ mt: 1, '& p': { my: 0.5 } }}>
              <ReactMarkdown>{entity.body}</ReactMarkdown>
            </Box>
          </Paper>
        </Stack>
      )}
    </DetailDrawer>
  );
}
```

- [ ] **Step 6.4: Run test to verify it passes**

Run: `npx vitest run tests/renderer/components/CustomizationViewDrawer.test.tsx`
Expected: PASS.

- [ ] **Step 6.5: Commit**

```bash
git add src/renderer/components/CustomizationViewDrawer.tsx tests/renderer/components/CustomizationViewDrawer.test.tsx
git commit -m "feat: add CustomizationViewDrawer for read-only customization preview"
```

---

## Task 7: Wire `CustomizationListScreen` row click → drawer; remove "View" action (TDD)

Same pattern as Task 5 but for the customization screen (skills/agents/commands/refs/global-instructions). Clicking opens the drawer; "Edit" inside the drawer closes it and opens the existing full-screen `CustomizationEditor`. The redundant "View" row action is removed.

**Files:**
- Modify: `src/renderer/components/CustomizationListScreen.tsx`
- Test: `tests/renderer/components/CustomizationListScreen.test.tsx` (new)

- [ ] **Step 7.1: Write the failing test**

Create `tests/renderer/components/CustomizationListScreen.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomizationListScreen } from '../../../src/renderer/components/CustomizationListScreen.js';
import { mockApi, ok, renderWithQuery, type CallSpy } from '../test-utils.js';

let call: CallSpy;

beforeEach(() => {
  call = mockApi();
});

const workspaceSkill = {
  id: 'a',
  frontmatter: { name: 'Workspace Skill', description: 'desc' },
  body: 'workspace body',
  source: { kind: 'workspace' },
};

const pluginSkill = {
  id: 'b',
  frontmatter: { name: 'Plugin Skill', description: 'plugin desc' },
  body: 'plugin body',
  source: { kind: 'plugin', pluginId: 'my-plugin' },
};

function renderScreen() {
  return renderWithQuery(
    <CustomizationListScreen
      entityType="skill"
      templateTargetType="skill"
      title="Skills"
      singular="skill"
      listMethod="skill.list"
      deleteMethod="skill.delete"
    />,
  );
}

describe('<CustomizationListScreen>', () => {
  it('opens a drawer when a workspace card is clicked', async () => {
    call.mockImplementation((method: string) => {
      if (method === 'skill.list') return Promise.resolve(ok([workspaceSkill]));
      return Promise.resolve(ok(undefined));
    });
    const user = userEvent.setup();
    renderScreen();

    const card = await screen.findByTestId('entity-grid-card-skill-workspace/a');
    await user.click(card);

    expect(await screen.findByTestId('detail-drawer-customization')).toBeInTheDocument();
    expect(screen.getByText('workspace body')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  it('hides Edit button in drawer for plugin items', async () => {
    call.mockImplementation((method: string) => {
      if (method === 'skill.list') return Promise.resolve(ok([pluginSkill]));
      return Promise.resolve(ok(undefined));
    });
    const user = userEvent.setup();
    renderScreen();

    const card = await screen.findByTestId('entity-grid-card-skill-plugin/b');
    await user.click(card);

    expect(await screen.findByTestId('detail-drawer-customization')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
  });

  it('does not show the "View" row action (replaced by row click)', async () => {
    call.mockImplementation((method: string) => {
      if (method === 'skill.list') return Promise.resolve(ok([pluginSkill]));
      return Promise.resolve(ok(undefined));
    });
    renderScreen();
    await screen.findByTestId('entity-grid-card-skill-plugin/b');
    expect(screen.queryByRole('button', { name: 'View' })).not.toBeInTheDocument();
  });
});
```

> **Note on getKey shape:** the `entity.getKey` is `${item.source.kind}/${item.id}` per the existing code, which yields card test IDs like `entity-grid-card-skill-workspace/a` — matching the test selectors above.

- [ ] **Step 7.2: Run test to verify it fails**

Run: `npx vitest run tests/renderer/components/CustomizationListScreen.test.tsx`
Expected: FAIL — drawer not wired up; "View" action still present.

- [ ] **Step 7.3: Update `CustomizationListScreen` to use the drawer and drop the View action**

In `src/renderer/components/CustomizationListScreen.tsx`:

1. Add to imports:

```tsx
import { CustomizationViewDrawer } from './CustomizationViewDrawer.js';
```

2. Remove the imports `VisibilityIcon` and `EntityViewer` (no longer used).

3. Update the `Editor` discriminated union to remove the `view` variant:

```tsx
type Editor =
  | { kind: 'closed' }
  | { kind: 'new'; template: Template }
  | { kind: 'create'; customization: Customization }
  | { kind: 'edit'; customization: Customization };
```

4. Add a separate state for the drawer:

```tsx
const [viewing, setViewing] = useState<CustomizationListItem | null>(null);
```

(Place it next to the other `useState` declarations near the top of the component.)

5. **Delete** the entire early-return block:

```tsx
if (editor.kind === 'view') {
  return (
    <EntityViewer
      entity={editor.entity}
      title={title}
      onBack={() => setEditor({ kind: 'closed' })}
    />
  );
}
```

6. **Remove** the `View` entry from the `actions` array. The array becomes:

```tsx
const actions: RowAction<CustomizationListItem>[] = [
  {
    label: 'Edit',
    icon: <EditIcon fontSize="small" />,
    hidden: (item) => !isWorkspace(item),
    onClick: (item) =>
      setEditor({
        kind: 'edit',
        customization: toCustomization(item),
      }),
  },
  {
    label: 'Duplicate',
    icon: <ContentCopyIcon fontSize="small" />,
    hidden: (item) => !isWorkspace(item),
    onClick: (item) =>
      setEditor({
        kind: 'create',
        customization: duplicateCustomization(toCustomization(item), items),
      }),
  },
  {
    label: 'Delete',
    icon: <DeleteOutlineIcon fontSize="small" />,
    variant: 'destructive',
    hidden: (item) => !isWorkspace(item),
    onClick: (item) => setConfirmDelete(item),
  },
];
```

7. Add `onRowClick` to the `<EntityDataGrid<CustomizationListItem>>` JSX (between `actions` and `searchPlaceholder`):

```tsx
onRowClick={(item) => setViewing(item)}
```

8. Just **before** the closing `</Container>` (after the delete confirmation `<Dialog>` and before `<Toast>`), render:

```tsx
<CustomizationViewDrawer
  entity={viewing}
  onClose={() => setViewing(null)}
  onEdit={(item) => {
    setViewing(null);
    setEditor({
      kind: 'edit',
      customization: toCustomization(item),
    });
  }}
/>
```

- [ ] **Step 7.4: Run tests to verify they pass**

Run: `npx vitest run tests/renderer/components/CustomizationListScreen.test.tsx`
Expected: PASS.

- [ ] **Step 7.5: Run typecheck to confirm no broken imports**

Run: `npm run typecheck`
Expected: PASS — `EntityViewer` import gone, `Editor` type narrowed.

- [ ] **Step 7.6: Commit**

```bash
git add src/renderer/components/CustomizationListScreen.tsx tests/renderer/components/CustomizationListScreen.test.tsx
git commit -m "feat: open customization details in drawer on row click"
```

---

## Task 8: Full verification

**Files:** none modified — verification only.

- [ ] **Step 8.1: Run the full test suite**

Run: `npm test`
Expected: PASS — all tests green, including pre-existing tests for `MarketplaceList`, `MarketplaceDetail`, `EntityDataGrid`, etc.

- [ ] **Step 8.2: Run lint**

Run: `npm run lint`
Expected: PASS — no new lint errors.

- [ ] **Step 8.3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS — both `tsconfig.node.json` and `tsconfig.web.json` clean.

- [ ] **Step 8.4: Manual smoke test in dev**

Run: `npm run dev`

In the running Electron app:

1. **Marketplaces screen** — click a marketplace card. The drawer opens on the right with the marketplace name + plugin list. Close → drawer closes, list still in place. Install a plugin from inside the drawer; close + reopen and confirm the install state persisted via the on-close `invalidateQueries`.
2. **Templates screen** — click a template card. Drawer opens with description and body markdown. Click the "Edit" button inside the drawer → drawer closes and full-screen `TemplateEditor` opens. The "View" row icon-button should be gone.
3. **Skills (or Agents/Commands/Refs/Global Instructions)** — click any card. Drawer opens. For workspace items, an "Edit" button is visible inside the drawer; for plugin items, no Edit button and a `ReadOnlyNotice` is shown. The "View" row icon-button should be gone for plugin items (it was previously the only action there).

If anything looks wrong (drawer width, scrolling, header overflow, missing badges) — fix it before moving on. Document any deviation in the commit message.

- [ ] **Step 8.5: Final commit (if smoke fixes were needed)**

```bash
git add -A
git commit -m "chore: tweaks from manual drawer smoke test"
```

If no fixes needed, skip this step.

---

## Notes for the engineer

- **Why no `EntityDataGrid` API change:** the existing `onRowClick` prop is enough. Each screen owning its own drawer state keeps the grid component free of view concerns and matches the user's preferred pattern.
- **Why editors stay full-screen:** converting `TemplateEditor` and `CustomizationEditor` (multi-section forms with frontmatter + markdown body) to drawers is a larger UX decision and is out of scope for this plan. The "Edit" button inside each drawer closes the drawer first, then opens the existing editor — so the existing editor flow is unchanged.
- **Why we drop the "View" row action:** it duplicates the row click. Keeping both wastes screen space on the card and confuses users. Plugin-source customizations no longer have any row action button at all (which is correct — they're read-only and the body is now reachable via row click).
- **Drawer width:** 560px on `sm+`, 100% on `xs`. Adjust `width` prop on `DetailDrawer` per screen if any one of them needs more room.
- **Test ID conventions:** all drawer roots use `data-testid="detail-drawer-<testId>"` so existing test patterns (`getByTestId(...)`) keep working.
