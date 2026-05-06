import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
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
import { EntityDataGrid } from '../../components/EntityDataGrid/index.js';
import type {
  EntityDef,
  RowAction,
} from '../../components/EntityDataGrid/index.js';
import type { Template, TemplateTargetType } from '../../../shared/template.js';

const TARGET_TYPE_LABEL: Record<TemplateTargetType, string> = {
  skill: 'Skills',
  agent: 'Agents',
  command: 'Commands',
  reference: 'References',
  'global-instruction': 'Global Instructions',
};

const TEMPLATES_QUERY_KEY = ['templates'] as const;

export function TemplateList(): React.ReactElement {
  const qc = useQueryClient();
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [viewing, setViewing] = useState<Template | null>(null);
  const [editor, setEditor] = useState<
    | { kind: 'closed' }
    | { kind: 'create'; template: Template }
    | { kind: 'edit'; template: Template }
  >({ kind: 'closed' });
  const [confirmDelete, setConfirmDelete] = useState<Template | null>(null);

  const { data, isLoading, error } = useQuery<Template[]>({
    queryKey: TEMPLATES_QUERY_KEY,
    queryFn: async () => {
      const list = await callIpc<Template[]>('template.list', {});
      return Array.isArray(list) ? list : [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (template: Template) => {
      await callIpc('template.delete', { id: template.id });
      return template;
    },
    onSuccess: async (template) => {
      setToast({
        variant: 'success',
        message: `${template.frontmatter.name} removed`,
      });
      await qc.invalidateQueries({ queryKey: TEMPLATES_QUERY_KEY });
    },
    onError: (err) => {
      const message = err instanceof IpcCallError ? err.message : String(err);
      setToast({ variant: 'error', message });
    },
  });

  if (editor.kind !== 'closed') {
    return (
      <TemplateEditor
        initial={editor.template}
        isCreate={editor.kind === 'create'}
        onSaved={async () => {
          setEditor({ kind: 'closed' });
          await qc.invalidateQueries({ queryKey: TEMPLATES_QUERY_KEY });
        }}
        onCancel={() => setEditor({ kind: 'closed' })}
      />
    );
  }

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

  const entity: EntityDef<Template> = {
    name: 'template',
    pluralName: 'templates',
    getKey: (item) => item.id,
    fields: [
      {
        key: 'frontmatter.name',
        label: 'Name',
        primary: true,
        searchable: true,
      },
      {
        key: 'frontmatter.targetType',
        label: 'Target',
        badge: true,
        searchable: true,
        render: (item) => TARGET_TYPE_LABEL[item.frontmatter.targetType],
      },
      {
        key: 'frontmatter.version',
        label: 'Version',
        badge: true,
        render: (item) => `v${item.frontmatter.version}`,
      },
      {
        key: 'frontmatter.description',
        label: 'Description',
        secondary: true,
        searchable: true,
      },
    ],
  };

  const actions: RowAction<Template>[] = [
    {
      label: 'View',
      icon: <VisibilityIcon fontSize="small" />,
      onClick: (item) => setViewing(item),
    },
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

  return (
    <Container
      component="main"
      data-testid="template-list"
      maxWidth="lg"
      sx={{ py: 2.5 }}
    >
      <Stack
        direction="row"
        sx={{ mb: 0.5, justifyContent: 'space-between', alignItems: 'center' }}
      >
        <Typography variant="h5" component="h1">
          Templates
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Reusable starting points for your skills, agents, commands, references,
        and global instructions.
      </Typography>

      <EntityDataGrid<Template>
        entity={entity}
        data={data}
        isLoading={isLoading}
        error={error}
        actions={actions}
        searchPlaceholder="Search templates…"
        toolbarActions={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() =>
              setEditor({ kind: 'create', template: emptyTemplate() })
            }
            data-testid="new-template-button"
          >
            New template
          </Button>
        }
      />

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
          <Button
            color="error"
            onClick={() => {
              if (confirmDelete) deleteMutation.mutate(confirmDelete);
              setConfirmDelete(null);
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </Container>
  );
}
