import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Container,
  FormControl,
  FormControlLabel,
  FormGroup,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { callIpc, IpcCallError } from '../../lib/ipc.js';
import { Toast, type ToastMessage } from '../../components/Toast.js';
import type { CustomizationScope } from '../../../shared/customization.js';
import type {
  Template,
  TemplateFrontmatter,
  TemplateTargetType,
} from '../../../shared/template.js';

const TARGET_TYPES: TemplateTargetType[] = [
  'skill',
  'agent',
  'command',
  'reference',
  'global-instruction',
];

const TARGET_TYPE_LABEL: Record<TemplateTargetType, string> = {
  skill: 'Skill',
  agent: 'Agent',
  command: 'Command',
  reference: 'Reference',
  'global-instruction': 'Global Instruction',
};

interface TemplateEditorProps {
  initial: Template;
  isCreate: boolean;
  onSaved: (template: Template) => void | Promise<void>;
  onCancel: () => void;
}

type BodyView = 'edit' | 'preview' | 'split';

export function TemplateEditor({
  initial,
  isCreate,
  onSaved,
  onCancel,
}: TemplateEditorProps): React.ReactElement {
  const [frontmatter, setFrontmatter] = useState<TemplateFrontmatter>(initial.frontmatter);
  const [body, setBody] = useState(initial.body);
  const [tagDraft, setTagDraft] = useState('');
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [saving, setSaving] = useState(false);
  const [bodyView, setBodyView] = useState<BodyView>('split');

  const update = <K extends keyof TemplateFrontmatter>(
    key: K,
    value: TemplateFrontmatter[K],
  ): void => {
    setFrontmatter((fm) => ({ ...fm, [key]: value }));
  };

  const addTag = (): void => {
    const next = tagDraft.trim();
    if (!next) return;
    const existing = frontmatter.tags ?? [];
    if (existing.includes(next)) {
      setTagDraft('');
      return;
    }
    update('tags', [...existing, next]);
    setTagDraft('');
  };

  const removeTag = (tag: string): void => {
    const existing = frontmatter.tags ?? [];
    update('tags', existing.filter((t) => t !== tag));
  };

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    try {
      const saved = await callIpc<Template>('template.save', {
        template: {
          id: initial.id,
          frontmatter,
          body,
        },
        isCreate,
      });
      setToast({ variant: 'success', message: `${saved.frontmatter.name} saved` });
      await onSaved(saved);
    } catch (err) {
      if (
        err instanceof IpcCallError &&
        err.kind === 'validation' &&
        Array.isArray(err.details?.errors)
      ) {
        const errors = err.details.errors as Array<{ path: string; message: string }>;
        const list = errors.map((e) => `${e.path}: ${e.message}`).join('\n');
        setToast({
          variant: 'error',
          message: `${errors.length} validation error(s)\n${list}`,
        });
      } else {
        const message = err instanceof IpcCallError ? err.message : String(err);
        setToast({ variant: 'error', message });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container
      component="main"
      data-testid="template-editor"
      maxWidth="lg"
      sx={{ py: 4 }}
    >
      <Stack
        direction="row"
        spacing={2}
        sx={{ mb: 3, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}
      >
        <Typography variant="h4" component="h1">
          {isCreate ? 'New template' : `Edit ${initial.frontmatter.name}`}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleSave()}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </Stack>
      </Stack>

      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
          Frontmatter
        </Typography>
        <Stack spacing={2}>
          <TextField
            label="Name"
            value={frontmatter.name}
            onChange={(e) => update('name', e.target.value)}
            slotProps={{
              htmlInput: {
                pattern: '^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$',
                title:
                  'lowercase letters, digits and hyphens only (1-64 chars, no leading/trailing hyphen)',
                'data-testid': 'template-name-input',
              },
            }}
            fullWidth
          />
          <FormControl fullWidth>
            <InputLabel id="template-target-type-label">Target type</InputLabel>
            <Select
              labelId="template-target-type-label"
              label="Target type"
              value={frontmatter.targetType}
              onChange={(e) => update('targetType', e.target.value as TemplateTargetType)}
              data-testid="template-target-type-select"
            >
              {TARGET_TYPES.map((tt) => (
                <MenuItem key={tt} value={tt}>
                  {TARGET_TYPE_LABEL[tt]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Description"
            value={frontmatter.description}
            onChange={(e) => update('description', e.target.value)}
            slotProps={{ htmlInput: { maxLength: 200 } }}
            helperText={`${frontmatter.description.length}/200`}
            fullWidth
          />
          <TextField
            label="Version"
            value={frontmatter.version}
            onChange={(e) => update('version', e.target.value)}
            sx={{ maxWidth: 200 }}
          />
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
              Scope
            </Typography>
            <FormGroup row>
              {(['personal', 'project'] as const).map((value) => (
                <FormControlLabel
                  key={value}
                  control={
                    <Checkbox
                      checked={frontmatter.scopes.includes(value)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? Array.from(new Set([...frontmatter.scopes, value]))
                          : frontmatter.scopes.filter((s) => s !== value);
                        update('scopes', next as CustomizationScope[]);
                      }}
                    />
                  }
                  label={value}
                />
              ))}
            </FormGroup>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
              Tags
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
              {(frontmatter.tags ?? []).map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  size="small"
                  onDelete={() => removeTag(tag)}
                />
              ))}
              {(frontmatter.tags ?? []).length === 0 && (
                <Typography variant="caption" color="text.secondary">
                  No tags.
                </Typography>
              )}
            </Stack>
            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                placeholder="Add tag"
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
                }}
                slotProps={{ htmlInput: { 'data-testid': 'template-tag-input' } }}
              />
              <Button onClick={addTag} variant="outlined" size="small">
                Add
              </Button>
            </Stack>
          </Box>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 3 }}>
        <Stack
          direction="row"
          sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}
        >
          <Typography variant="h6" component="h2">
            Body
          </Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={bodyView}
            onChange={(_, v: BodyView | null) => v && setBodyView(v)}
          >
            <ToggleButton value="edit">Edit</ToggleButton>
            <ToggleButton value="split">Split</ToggleButton>
            <ToggleButton value="preview">Preview</ToggleButton>
          </ToggleButtonGroup>
        </Stack>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: bodyView === 'split' ? '1fr 1fr' : '1fr',
            gap: 2,
          }}
        >
          {(bodyView === 'edit' || bodyView === 'split') && (
            <TextField
              value={body}
              onChange={(e) => setBody(e.target.value)}
              multiline
              minRows={16}
              fullWidth
              slotProps={{
                htmlInput: {
                  'data-testid': 'template-body-textarea',
                  style: {
                    fontFamily:
                      '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                    fontSize: '0.9rem',
                    lineHeight: 1.5,
                  },
                },
              }}
            />
          )}
          {(bodyView === 'preview' || bodyView === 'split') && (
            <Box
              data-testid="template-body-preview"
              sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                p: 2,
                minHeight: 240,
                bgcolor: 'background.default',
                overflow: 'auto',
                '& h1, & h2, & h3': { mt: 1.5, mb: 1 },
                '& p': { my: 1 },
                '& code': {
                  bgcolor: 'action.hover',
                  px: 0.5,
                  borderRadius: 0.5,
                  fontFamily: 'monospace',
                },
                '& pre': {
                  bgcolor: 'action.hover',
                  p: 1.5,
                  borderRadius: 1,
                  overflow: 'auto',
                },
              }}
            >
              <ReactMarkdown>{body}</ReactMarkdown>
            </Box>
          )}
        </Box>
      </Paper>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </Container>
  );
}

export function emptyTemplate(): Template {
  return {
    id: '',
    frontmatter: {
      name: '',
      targetType: 'skill',
      description: '',
      scopes: ['personal'],
      version: '1.0.0',
      tags: [],
      createdAt: '',
      updatedAt: '',
    },
    body: '',
  };
}
