import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import { callIpc, IpcCallError } from '../../lib/ipc.js';
import { Toast, type ToastMessage } from '../../components/Toast.js';
import { EntityViewer } from '../../components/EntityViewer.js';
import { TemplateEditor, emptyTemplate } from './TemplateEditor.js';
import type { Template, TemplateTargetType } from '../../../shared/template.js';

const TARGET_TYPE_LABEL: Record<TemplateTargetType, string> = {
  skill: 'Skills',
  agent: 'Agents',
  command: 'Commands',
  reference: 'References',
  'global-instruction': 'Global Instructions',
};

const TARGET_TYPE_ORDER: TemplateTargetType[] = [
  'skill',
  'agent',
  'command',
  'reference',
  'global-instruction',
];

export function TemplateList(): React.ReactElement {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [viewing, setViewing] = useState<Template | null>(null);
  const [editor, setEditor] = useState<
    { kind: 'closed' } | { kind: 'create'; template: Template } | { kind: 'edit'; template: Template }
  >({ kind: 'closed' });
  const [confirmDelete, setConfirmDelete] = useState<Template | null>(null);

  const load = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const list = await callIpc<Template[]>('template.list', {});
      setTemplates(Array.isArray(list) ? list : []);
    } catch (err) {
      const message = err instanceof IpcCallError ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<TemplateTargetType, Template[]>();
    for (const tpl of templates) {
      const key = tpl.frontmatter.targetType;
      const arr = map.get(key) ?? [];
      arr.push(tpl);
      map.set(key, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.frontmatter.name.localeCompare(b.frontmatter.name));
    }
    return map;
  }, [templates]);

  const handleDeleteConfirmed = async (): Promise<void> => {
    if (!confirmDelete) return;
    try {
      await callIpc('template.delete', { id: confirmDelete.id });
      setTemplates((prev) => prev.filter((t) => t.id !== confirmDelete.id));
      setToast({
        variant: 'success',
        message: `${confirmDelete.frontmatter.name} removed`,
      });
    } catch (err) {
      const message = err instanceof IpcCallError ? err.message : String(err);
      setToast({ variant: 'error', message });
    } finally {
      setConfirmDelete(null);
    }
  };

  if (editor.kind !== 'closed') {
    return (
      <TemplateEditor
        initial={editor.template}
        isCreate={editor.kind === 'create'}
        onSaved={async () => {
          setEditor({ kind: 'closed' });
          await load();
        }}
        onCancel={() => setEditor({ kind: 'closed' })}
      />
    );
  }

  if (viewing) {
    return (
      <EntityViewer
        entity={{
          frontmatter: viewing.frontmatter as unknown as { name: string } & Record<string, unknown>,
          body: viewing.body,
          source: { kind: 'workspace' },
        }}
        title="Templates"
        onBack={() => setViewing(null)}
      />
    );
  }

  return (
    <Container
      component="main"
      data-testid="template-list"
      maxWidth="md"
      sx={{ py: 4 }}
    >
      <Stack
        direction="row"
        sx={{ mb: 3, justifyContent: 'space-between', alignItems: 'center' }}
      >
        <Typography variant="h4" component="h1">
          Templates
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setEditor({ kind: 'create', template: emptyTemplate() })}
          data-testid="new-template-button"
        >
          New template
        </Button>
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Reusable starting points for your skills, agents, commands, references, and global instructions.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!loading && templates.length === 0 && !error && (
        <Box
          sx={{
            py: 6,
            textAlign: 'center',
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
            borderStyle: 'dashed',
          }}
        >
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            No templates yet.
          </Typography>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => setEditor({ kind: 'create', template: emptyTemplate() })}
          >
            Create your first template
          </Button>
        </Box>
      )}

      {TARGET_TYPE_ORDER.map((targetType) => {
        const items = grouped.get(targetType) ?? [];
        if (items.length === 0) return null;
        return (
          <Box key={targetType} sx={{ mb: 3 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
              <Typography variant="overline" color="text.secondary">
                {TARGET_TYPE_LABEL[targetType]}
              </Typography>
              <Chip label={items.length} size="small" sx={{ height: 18, fontSize: 10 }} />
            </Stack>
            <List
              disablePadding
              sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: 1.5,
                bgcolor: 'background.paper',
              }}
            >
              {items.map((tpl, idx) => (
                <ListItem
                  key={tpl.id}
                  data-testid={`template-item-${tpl.id}`}
                  divider={idx < items.length - 1}
                  secondaryAction={
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title="View">
                        <IconButton
                          size="small"
                          onClick={() => setViewing(tpl)}
                          aria-label="View template"
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          onClick={() => setEditor({ kind: 'edit', template: tpl })}
                          aria-label="Edit template"
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => setConfirmDelete(tpl)}
                          aria-label="Delete template"
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  }
                >
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <Box component="strong">{tpl.frontmatter.name}</Box>
                        <Chip
                          label={`v${tpl.frontmatter.version}`}
                          size="small"
                          variant="outlined"
                          sx={{ height: 18, fontSize: 10 }}
                        />
                      </Stack>
                    }
                    secondary={tpl.frontmatter.description}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        );
      })}

      <Dialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        aria-label="Confirm template deletion"
        data-testid="confirm-template-delete-dialog"
      >
        <DialogTitle>Confirm deletion</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Remove template <strong>{confirmDelete?.frontmatter.name}</strong>?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button color="error" onClick={() => void handleDeleteConfirmed()}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </Container>
  );
}
