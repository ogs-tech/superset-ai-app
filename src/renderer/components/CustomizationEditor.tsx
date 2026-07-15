import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Box, Button, Checkbox, CircularProgress, Container, FormControlLabel,
  FormGroup, Paper, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import { Kicker } from './ds/Kicker.js';
import { fonts } from '../tokens.js';
import { callIpc, IpcCallError } from '../lib/ipc.js';
import { Toast, type ToastMessage } from './Toast.js';
import { SyncReportModal } from './SyncReportModal.js';
import type { Agent, Instruction, Scope, Skill } from '../../shared/entity.js';
import { entityUrn } from '../../shared/entity.js';
import type { SyncResult } from '../../shared/sync-result.js';
import { entityBody, withEntityBody } from '../lib/entity-body.js';

type EditableEntity = Skill | Agent | Instruction;

const SAVE_BY_KIND: Record<EditableEntity['kind'], { method: string; payloadKey: string; resultKey: string }> = {
  skill: { method: 'skill.save', payloadKey: 'skill', resultKey: 'skill' },
  agent: { method: 'agent.save', payloadKey: 'agent', resultKey: 'agent' },
  instruction: { method: 'instruction.save', payloadKey: 'instruction', resultKey: 'instruction' },
};

// TODO(follow-up): reintroduce 'project' for skill/agent once each carries its
// own repoPath (mirroring ProjectInstruction). Blocked at the schema level
// today after settings.linkedRepos was removed.
const scopeOptionsFor = (kind: EditableEntity['kind']): readonly Scope[] =>
  kind === 'instruction' ? (['personal', 'project'] as const) : (['personal'] as const);

export type EditorHiddenField = 'name' | 'scope' | 'description' | 'version';

interface CustomizationEditorProps {
  initial: EditableEntity;
  isCreate: boolean;
  onSaved: (saved: EditableEntity) => void | Promise<void>;
  onCancel: () => void;
  /**
   * Fields the parent screen doesn't want the user to see. Instructions use
   * this heavily: the personal singleton hides `name` and `scope` (they're
   * fixed at `default` / `personal`), and both instruction kinds may hide
   * description/version depending on the screen's info density.
   */
  hiddenFields?: ReadonlySet<EditorHiddenField>;
  /**
   * Optional heading override used by the instruction screens ("Editar
   * instrução pessoal", "Editar acme"). Defaults to the generic
   * "Nova customização" / "Editar <name>".
   */
  titleOverride?: { create: string; edit: string };
}

type BodyView = 'edit' | 'preview' | 'split';

export function CustomizationEditor({
  initial,
  isCreate,
  onSaved,
  onCancel,
  hiddenFields,
  titleOverride,
}: CustomizationEditorProps): React.ReactElement {
  const [entity, setEntity] = useState<EditableEntity>(initial);
  const [body, setBody] = useState(entityBody(initial));
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncReport, setSyncReport] = useState<SyncResult[]>([]);
  const [bodyView, setBodyView] = useState<BodyView>('split');

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    try {
      // Preserve the original URN on edit so EntityService detects a name change
      // as a rename (old previousUrn !== new urn) instead of writing a duplicate.
      // On create the entity carries urn '' (from blankCustomization), so derive it.
      const urn = entity.urn || entityUrn(entity.kind, entity.name);
      const toSave = withEntityBody({ ...entity, urn }, body);
      const { method, payloadKey, resultKey } = SAVE_BY_KIND[toSave.kind];
      const result = await callIpc<Record<string, unknown>>(method, { [payloadKey]: toSave, isCreate });
      const saved = result[resultKey] as EditableEntity;
      const report = (result['syncReport'] as SyncResult[] | undefined) ?? [];

      setToast({ variant: 'success', message: `${saved.name} salvo` });
      if (report.some((entry) => entry.status !== 'ok')) setSyncReport(report);
      await onSaved(saved);
    } catch (err) {
      if (err instanceof IpcCallError && err.kind === 'validation' && Array.isArray(err.details?.errors)) {
        const errors = err.details.errors as Array<{ path: string; message: string }>;
        const list = errors.map((e) => `${e.path}: ${e.message}`).join('\n');
        setToast({ variant: 'error', message: `${errors.length} validation error(s)\n${list}` });
      } else {
        setToast({ variant: 'error', message: err instanceof IpcCallError ? err.message : String(err) });
      }
    } finally {
      setSaving(false);
    }
  };

  const isHidden = (field: EditorHiddenField): boolean => hiddenFields?.has(field) ?? false;
  const title = titleOverride
    ? (isCreate ? titleOverride.create : titleOverride.edit)
    : (isCreate ? 'Nova customização' : `Editar ${initial.name}`);
  const showFrontmatter =
    !isHidden('name') || !isHidden('description') || !isHidden('version') || !isHidden('scope');

  return (
    <Container component="main" data-testid="customization-editor" maxWidth="lg" sx={{ py: 4 }}>
      <Stack direction="row" spacing={2} sx={{ mb: 3, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography variant="h4" component="h1">
          {title}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={onCancel}>Cancelar</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}>
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </Stack>
      </Stack>

      {showFrontmatter && (
        <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
          <Box sx={{ mb: 2 }}><Kicker>Frontmatter</Kicker></Box>
          <Stack spacing={2}>
            {!isHidden('name') && (
              <TextField
                label="Name"
                value={entity.name}
                onChange={(e) => setEntity((prev) => ({ ...prev, name: e.target.value } as EditableEntity))}
                slotProps={{ htmlInput: { pattern: '^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$', title: 'lowercase letters, digits and hyphens only (1-64 chars, no leading/trailing hyphen)' } }}
                fullWidth
              />
            )}
            {!isHidden('description') && (
              <TextField
                label="Description"
                value={entity.description}
                onChange={(e) => setEntity((prev) => ({ ...prev, description: e.target.value }))}
                slotProps={{ htmlInput: { maxLength: 200 } }}
                helperText={`${entity.description.length}/200`}
                fullWidth
              />
            )}
            {!isHidden('version') && (
              <TextField
                label="Version"
                value={entity.metadata.version}
                onChange={(e) => setEntity((prev) => ({ ...prev, metadata: { ...prev.metadata, version: e.target.value } }))}
                sx={{ maxWidth: 200 }}
              />
            )}
            {!isHidden('scope') && (
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Scope</Typography>
                <FormGroup row>
                  {(scopeOptionsFor(entity.kind)).map((value) => (
                    <FormControlLabel
                      key={value}
                      control={
                        <Checkbox
                          checked={(entity.scopes as Scope[]).includes(value)}
                          onChange={(e) => {
                            const scopesArr = entity.scopes as Scope[];
                            const next: Scope[] = e.target.checked
                              ? Array.from(new Set([...scopesArr, value]))
                              : scopesArr.filter((s) => s !== value);
                            setEntity((prev) => ({ ...prev, scopes: next } as unknown as EditableEntity));
                          }}
                        />
                      }
                      label={value}
                    />
                  ))}
                </FormGroup>
              </Box>
            )}
          </Stack>
        </Paper>
      )}

      <Paper variant="outlined" sx={{ p: 3 }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Kicker>Body</Kicker>
          <ToggleButtonGroup size="small" exclusive value={bodyView} onChange={(_, v: BodyView | null) => v && setBodyView(v)}>
            <ToggleButton value="edit">Editar</ToggleButton>
            <ToggleButton value="split">Dividir</ToggleButton>
            <ToggleButton value="preview">Prévia</ToggleButton>
          </ToggleButtonGroup>
        </Stack>

        <Box sx={{ display: 'grid', gridTemplateColumns: bodyView === 'split' ? '1fr 1fr' : '1fr', gap: 2 }}>
          {(bodyView === 'edit' || bodyView === 'split') && (
            <TextField
              value={body}
              onChange={(e) => setBody(e.target.value)}
              multiline minRows={16} fullWidth
              slotProps={{ htmlInput: { 'data-testid': 'body-textarea', style: { fontFamily: fonts.mono, fontSize: '0.9rem', lineHeight: 1.5 } } }}
            />
          )}
          {(bodyView === 'preview' || bodyView === 'split') && (
            <Box
              data-testid="markdown-preview"
              sx={{
                border: 1, borderColor: 'divider', borderRadius: 1, p: 2, minHeight: 240,
                bgcolor: 'background.default', overflow: 'auto',
                '& h1, & h2, & h3': { mt: 1.5, mb: 1 }, '& p': { my: 1 },
                '& code': { bgcolor: 'action.hover', px: 0.5, borderRadius: 0.5, fontFamily: 'monospace' },
                '& pre': { bgcolor: 'action.hover', p: 1.5, borderRadius: 1, overflow: 'auto' },
              }}
            >
              <ReactMarkdown>{body}</ReactMarkdown>
            </Box>
          )}
        </Box>
      </Paper>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
      <SyncReportModal report={syncReport} onClose={() => setSyncReport([])} />
    </Container>
  );
}
