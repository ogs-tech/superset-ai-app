import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import HandshakeRoundedIcon from '@mui/icons-material/HandshakeRounded';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import NotesRoundedIcon from '@mui/icons-material/NotesRounded';
import { callIpc, IpcCallError } from '../../lib/ipc.js';
import { Toast, type ToastMessage } from '../../components/Toast.js';
import { CustomizationEditor } from '../../components/CustomizationEditor.js';
import { blankCustomization } from '../../lib/blank-customization.js';
import { defaultGlobalInstruction } from '../../lib/default-global-instruction.js';
import type { Customization } from '../../../shared/customization.js';

const SLUG = 'default';

const ACCENT = '#6f42c1';

interface DisplaySection {
  title: string;
  blurb: string;
  icon: React.ReactNode;
  accent: string;
}

/**
 * The four H2 sections the SDE template ships with, ordered weakest → strongest
 * to mirror the precedence rule in the body. Used as the "what you'll get"
 * preview in the empty state, and as icon/accent metadata when summarizing a
 * saved profile whose headings match.
 */
const SECTIONS: readonly DisplaySection[] = [
  {
    title: 'How to work with me',
    blurb: 'Concise replies, one focused question when blocked, no ceremony.',
    icon: <ForumRoundedIcon fontSize="small" />,
    accent: '#2b5cff',
  },
  {
    title: 'Engineering defaults',
    blurb: 'TDD where it fits, root-cause fixes, lint + typecheck before done.',
    icon: <BoltRoundedIcon fontSize="small" />,
    accent: '#0a7d6b',
  },
  {
    title: 'Communication',
    blurb: 'Be specific, state trade-offs, surface uncertainty out loud.',
    icon: <HandshakeRoundedIcon fontSize="small" />,
    accent: '#c9760a',
  },
  {
    title: 'Action safety',
    blurb: 'Reversible? Act. Hard to undo? Pause and confirm first.',
    icon: <ShieldRoundedIcon fontSize="small" />,
    accent: '#c2255c',
  },
];

const SECTION_META = new Map(SECTIONS.map((s) => [s.title.toLowerCase(), s]));

/**
 * Summarize a saved profile by its own `## ` headings so the configured view
 * reflects what the user actually wrote — not the template they may have
 * replaced. Known headings keep their template icon/accent; anything else gets
 * a neutral style with its first content line as the blurb.
 */
function parseSections(body: string): DisplaySection[] {
  const lines = body.split('\n');
  const sections: DisplaySection[] = [];

  for (let i = 0; i < lines.length; i++) {
    const heading = /^##\s+(.+?)\s*$/.exec(lines[i] ?? '');
    if (!heading) continue;
    const title = heading[1] ?? '';

    let blurb = '';
    for (let j = i + 1; j < lines.length && !/^##\s+/.test(lines[j] ?? ''); j++) {
      const raw = (lines[j] ?? '').trim();
      if (!raw || raw.startsWith('#')) continue;
      blurb = raw.replace(/^[-*•]\s*/, '').replace(/[`*]/g, '');
      break;
    }
    if (blurb.length > 110) blurb = `${blurb.slice(0, 109).trimEnd()}…`;

    const known = SECTION_META.get(title.toLowerCase());
    sections.push(
      known
        ? { ...known, blurb: blurb || known.blurb }
        : { title, blurb, icon: <NotesRoundedIcon fontSize="small" />, accent: ACCENT },
    );
  }
  return sections;
}

/**
 * Where the single `default` slot is symlinked once saved — mirrors the
 * destinations returned by claude-adapter and copilot-adapter so the user knows
 * exactly what gets written.
 */
const DESTINATIONS = [
  { assistant: 'Claude Code', path: '~/.claude/CLAUDE.md' },
  { assistant: 'GitHub Copilot', path: '~/.copilot/instructions/copilot-instructions.md' },
] as const;

const fadeIn = {
  '@keyframes giFadeIn': {
    from: { opacity: 0, transform: 'translateY(8px)' },
    to: { opacity: 1, transform: 'translateY(0)' },
  },
};

const QUERY_KEY = ['global-instruction', SLUG] as const;

export function GlobalInstructionScreen(): React.ReactElement {
  const queryClient = useQueryClient();
  const [editor, setEditor] = useState<{
    customization: Customization;
    isCreate: boolean;
  } | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const { data, isLoading, isError, error } = useQuery<Customization | null>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      try {
        return await callIpc<Customization>('global-instruction.get', { id: SLUG });
      } catch (err) {
        if (err instanceof IpcCallError && err.kind === 'not_found') return null;
        throw err;
      }
    },
  });

  const existing = data ?? null;
  const loaded = !isLoading;
  const loadError = isError
    ? error instanceof IpcCallError
      ? error.message
      : String(error)
    : null;

  const openEdit = (): void => {
    if (existing) setEditor({ customization: existing, isCreate: false });
  };
  const openTemplate = (): void => setEditor({ customization: defaultGlobalInstruction(), isCreate: true });
  const openBlank = (): void =>
    setEditor({ customization: blankCustomization('global-instruction'), isCreate: true });

  if (editor) {
    return (
      <CustomizationEditor
        initial={editor.customization}
        isCreate={editor.isCreate}
        onSaved={async (saved) => {
          setEditor(null);
          setToast({ variant: 'success', message: `${saved.frontmatter.name} saved` });
          await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
        }}
        onCancel={() => setEditor(null)}
      />
    );
  }

  return (
    <Container
      component="main"
      data-testid="global-instruction-screen"
      maxWidth="md"
      sx={{ py: 2.5, ...fadeIn }}
    >
      {/* Hero */}
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mb: 4 }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: ACCENT,
            backgroundColor: `${ACCENT}1a`,
          }}
        >
          <PublicRoundedIcon />
        </Box>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
            Global Instructions
          </Typography>
          <Typography variant="body2" color="text.secondary">
            One profile, distributed to every enabled assistant
          </Typography>
        </Box>
        {loaded && existing && (
          <Chip
            label="Configured"
            color="success"
            size="small"
            icon={<CheckCircleIcon fontSize="small" />}
            sx={{ ml: 'auto' }}
          />
        )}
      </Stack>

      {loadError ? (
        <Paper variant="outlined" sx={{ p: 3, borderColor: 'error.main' }}>
          <Typography variant="body2" color="error">
            Couldn't load global instructions — {loadError}
          </Typography>
        </Paper>
      ) : (
        loaded &&
        (existing ? renderConfigured(existing, openEdit) : renderEmpty(openTemplate, openBlank))
      )}

      {/* Sync destinations — always shown, the constant truth of this screen */}
      <Paper variant="outlined" sx={{ p: 2.5, mt: 3, bgcolor: 'background.default' }}>
        <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.08em' }}>
          Synced to
        </Typography>
        <Stack divider={<Divider flexItem />} sx={{ mt: 1 }}>
          {DESTINATIONS.map((d) => (
            <Stack
              key={d.assistant}
              direction="row"
              spacing={2}
              sx={{ alignItems: 'center', justifyContent: 'space-between', py: 1 }}
            >
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {d.assistant}
              </Typography>
              <Box
                component="code"
                sx={{
                  fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: '0.78rem',
                  color: 'text.secondary',
                  bgcolor: 'action.hover',
                  px: 0.75,
                  py: 0.25,
                  borderRadius: 0.75,
                }}
              >
                {d.path}
              </Box>
            </Stack>
          ))}
        </Stack>
      </Paper>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </Container>
  );
}

function SectionRow({ section }: { section: DisplaySection }): React.ReactElement {
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
      <Box
        sx={{
          mt: 0.25,
          width: 30,
          height: 30,
          flexShrink: 0,
          borderRadius: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: section.accent,
          backgroundColor: `${section.accent}1a`,
        }}
      >
        {section.icon}
      </Box>
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.4 }}>
          {section.title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.4 }}>
          {section.blurb}
        </Typography>
      </Box>
    </Stack>
  );
}

function renderEmpty(onTemplate: () => void, onBlank: () => void): React.ReactElement {
  return (
    <Paper
      variant="outlined"
      data-testid="global-instruction-empty"
      sx={{ overflow: 'hidden', animation: 'giFadeIn 0.4s ease both' }}
    >
      <Box
        sx={{
          p: 3,
          background: `linear-gradient(135deg, ${ACCENT}14 0%, ${ACCENT}05 60%, transparent 100%)`,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Typography variant="h6" component="h2" sx={{ mb: 0.5 }}>
          Start with the SDE profile
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 560 }}>
          A curated, opinionated set of preferences and conventions — ready to use as-is or to
          shape into your own. Personal preferences, applied across every workspace and every
          enabled assistant.
        </Typography>
      </Box>

      <Box sx={{ p: 3 }}>
        <Stack spacing={2}>
          {SECTIONS.map((s) => (
            <SectionRow key={s.title} section={s} />
          ))}
        </Stack>

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mt: 2.5, fontStyle: 'italic' }}
        >
          On conflict, precedence runs bottom-up: Safety &gt; correctness &gt; style.
        </Typography>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          sx={{ mt: 3, alignItems: { sm: 'center' } }}
        >
          <Button
            variant="contained"
            startIcon={<AutoFixHighIcon />}
            onClick={onTemplate}
            data-testid="gi-use-template"
            sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#5a35a3' } }}
          >
            Use the SDE template
          </Button>
          <Button variant="text" onClick={onBlank} data-testid="gi-start-blank">
            Start from scratch
          </Button>
        </Stack>
      </Box>
    </Paper>
  );
}

function renderConfigured(
  existing: Customization,
  onEdit: () => void,
): React.ReactElement {
  const description = existing.frontmatter.description?.trim();
  const lineCount = existing.body.split('\n').filter((l) => l.trim()).length;
  const sections = parseSections(existing.body);

  return (
    <Paper
      variant="outlined"
      data-testid="global-instruction-configured"
      sx={{ p: 3, animation: 'giFadeIn 0.4s ease both' }}
    >
      <Stack
        direction="row"
        spacing={2}
        sx={{ justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}
      >
        <Box>
          <Typography variant="h6" component="h2" sx={{ mb: 0.5 }}>
            Your profile
          </Typography>
          {description && (
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 520 }}>
              {description}
            </Typography>
          )}
        </Box>
        <Button
          variant="outlined"
          startIcon={<EditIcon fontSize="small" />}
          onClick={onEdit}
          data-testid="gi-edit"
          sx={{ flexShrink: 0 }}
        >
          Edit
        </Button>
      </Stack>

      {sections.length > 0 && (
        <>
          <Divider sx={{ my: 2 }} />
          <Stack spacing={2}>
            {sections.map((s) => (
              <SectionRow key={s.title} section={s} />
            ))}
          </Stack>
        </>
      )}

      <Stack direction="row" spacing={1} sx={{ mt: 2.5, flexWrap: 'wrap' }}>
        <Chip size="small" variant="outlined" label={`v${existing.frontmatter.version}`} />
        <Chip size="small" variant="outlined" label="personal" />
        <Chip size="small" variant="outlined" label={`${lineCount} lines`} />
      </Stack>
    </Paper>
  );
}
