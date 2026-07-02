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

interface CustomizationEditorProps {
  initial: EditableEntity;
  isCreate: boolean;
  onSaved: (saved: EditableEntity) => void | Promise<void>;
  onCancel: () => void;
}

type BodyView = 'edit' | 'preview' | 'split';

export function CustomizationEditor({
  initial,
  isCreate,
  onSaved,
  onCancel,
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
      const toSave = withEntityBody({ ...entity, urn: entityUrn(entity.kind, entity.name) }, body);
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

  return (
    <Container component="main" data-testid="customization-editor" maxWidth="lg" sx={{ py: 4 }}>
      <Stack direction="row" spacing={2} sx={{ mb: 3, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography variant="h4" component="h1">
          {isCreate ? 'Nova customização' : `Editar ${initial.name}`}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={onCancel}>Cancelar</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}>
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </Stack>
      </Stack>

      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Box sx={{ mb: 2 }}><Kicker>Frontmatter</Kicker></Box>
        <Stack spacing={2}>
          <TextField
            label="Name"
            value={entity.name}
            onChange={(e) => setEntity((prev) => ({ ...prev, name: e.target.value }))}
            slotProps={{ htmlInput: { pattern: '^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$', title: 'lowercase letters, digits and hyphens only (1-64 chars, no leading/trailing hyphen)' } }}
            fullWidth
          />
          <TextField
            label="Description"
            value={entity.description}
            onChange={(e) => setEntity((prev) => ({ ...prev, description: e.target.value }))}
            slotProps={{ htmlInput: { maxLength: 200 } }}
            helperText={`${entity.description.length}/200`}
            fullWidth
          />
          <TextField
            label="Version"
            value={entity.metadata.version}
            onChange={(e) => setEntity((prev) => ({ ...prev, metadata: { ...prev.metadata, version: e.target.value } }))}
            sx={{ maxWidth: 200 }}
          />
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Scope</Typography>
            <FormGroup row>
              {(['personal', 'project'] as const).map((value) => (
                <FormControlLabel
                  key={value}
                  control={
                    <Checkbox
                      checked={entity.scopes.includes(value)}
                      onChange={(e) => {
                        const next: Scope[] = e.target.checked
                          ? Array.from(new Set([...entity.scopes, value]))
                          : entity.scopes.filter((s) => s !== value);
                        setEntity((prev) => ({ ...prev, scopes: next }));
                      }}
                    />
                  }
                  label={value}
                />
              ))}
            </FormGroup>
          </Box>
        </Stack>
      </Paper>

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
