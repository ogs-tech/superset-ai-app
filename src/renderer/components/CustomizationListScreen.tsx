import { useState } from 'react';
import {
  Box,
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
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { callIpc, IpcCallError } from '../lib/ipc.js';
import { Toast, type ToastMessage } from './Toast.js';
import { PluginOriginBadge } from './PluginOriginBadge.js';
import { NewFromTemplateDialog } from './NewFromTemplateDialog.js';
import { CustomizationEditor } from './CustomizationEditor.js';
import { EntityViewer } from './EntityViewer.js';
import { EntityDataGrid } from './EntityDataGrid/index.js';
import type { EntityDef, RowAction } from './EntityDataGrid/index.js';
import {
  useCustomizationList,
  useInvalidateCustomization,
  type CustomizationListItem,
} from '../hooks/use-customization-list.js';
import type {
  Customization,
  CustomizationType,
} from '../../shared/customization.js';
import type { Template, TemplateTargetType } from '../../shared/template.js';

interface CustomizationListScreenProps {
  entityType: CustomizationType;
  templateTargetType: TemplateTargetType;
  title: string;
  singular: string;
  listMethod: string;
  deleteMethod: string;
}

type Editor =
  | { kind: 'closed' }
  | { kind: 'new'; template: Template }
  | { kind: 'create'; customization: Customization }
  | { kind: 'edit'; customization: Customization }
  | { kind: 'view'; entity: CustomizationListItem };

export function CustomizationListScreen({
  entityType,
  templateTargetType,
  title,
  singular,
  listMethod,
  deleteMethod,
}: CustomizationListScreenProps): React.ReactElement {
  const { data, isLoading, error } = useCustomizationList(
    entityType,
    listMethod,
  );
  const invalidate = useInvalidateCustomization();

  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [editor, setEditor] = useState<Editor>({ kind: 'closed' });
  const [confirmDelete, setConfirmDelete] =
    useState<CustomizationListItem | null>(null);

  const items = data ?? [];

  const toCustomization = (entity: CustomizationListItem): Customization => ({
    id: `${entityType}/${entity.frontmatter.name}`,
    frontmatter: {
      ...entity.frontmatter,
      type: entityType,
    } as Customization['frontmatter'],
    body: entity.body,
  });

  const handleSaved = async (saved: Customization): Promise<void> => {
    setEditor({ kind: 'closed' });
    setToast({
      variant: 'success',
      message: `${saved.frontmatter.name} saved`,
    });
    await invalidate(entityType);
  };

  const handleDeleteConfirmed = async (): Promise<void> => {
    if (!confirmDelete) return;
    try {
      await callIpc(deleteMethod, {
        id: confirmDelete.frontmatter.name,
        removeSymlinks: true,
      });
      setToast({
        variant: 'success',
        message: `${confirmDelete.frontmatter.name} removed`,
      });
      await invalidate(entityType);
    } catch (err) {
      const message = err instanceof IpcCallError ? err.message : String(err);
      setToast({ variant: 'error', message });
    } finally {
      setConfirmDelete(null);
    }
  };

  if (editor.kind === 'view') {
    return (
      <EntityViewer
        entity={editor.entity}
        title={title}
        onBack={() => setEditor({ kind: 'closed' })}
      />
    );
  }

  if (editor.kind !== 'closed') {
    const initial =
      editor.kind === 'edit' || editor.kind === 'create'
        ? editor.customization
        : customizationFromTemplate(editor.template, entityType);
    return (
      <CustomizationEditor
        initial={initial}
        isCreate={editor.kind === 'new' || editor.kind === 'create'}
        onSaved={handleSaved}
        onCancel={() => setEditor({ kind: 'closed' })}
      />
    );
  }

  const entity: EntityDef<CustomizationListItem> = {
    name: entityType,
    pluralName: `${singular}s`,
    getKey: (item) => `${item.source.kind}/${item.id}`,
    fields: [
      {
        key: 'frontmatter.name',
        label: 'Name',
        primary: true,
        searchable: true,
        render: (item) => (
          <Stack direction="row" sx={{ alignItems: 'center' }}>
            <Box component="span">{item.frontmatter.name}</Box>
            {item.source.kind === 'plugin' && (
              <PluginOriginBadge pluginId={item.source.pluginId} />
            )}
          </Stack>
        ),
      },
      {
        key: 'frontmatter.description',
        label: 'Description',
        secondary: true,
        searchable: true,
      },
      {
        key: 'source.kind',
        label: 'Source',
        badge: true,
        render: (item) =>
          item.source.kind === 'plugin' ? `plugin:${item.source.pluginId}` : 'workspace',
      },
    ],
  };

  const isWorkspace = (item: CustomizationListItem): boolean =>
    item.source.kind === 'workspace';

  const actions: RowAction<CustomizationListItem>[] = [
    {
      label: 'View',
      icon: <VisibilityIcon fontSize="small" />,
      hidden: (item) => isWorkspace(item),
      onClick: (item) => setEditor({ kind: 'view', entity: item }),
    },
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

  return (
    <Container
      component="main"
      data-testid={`entity-list-${entityType}`}
      maxWidth="lg"
      sx={{ py: 2.5 }}
    >
      <Stack
        direction="row"
        sx={{ mb: 2, justifyContent: 'space-between', alignItems: 'center' }}
      >
        <Typography variant="h5" component="h1">
          {title}
        </Typography>
      </Stack>

      <EntityDataGrid<CustomizationListItem>
        entity={entity}
        data={items}
        isLoading={isLoading}
        error={error}
        actions={actions}
        searchPlaceholder={`Search ${singular}s…`}
        toolbarActions={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setShowTemplateDialog(true)}
            data-testid={`new-${entityType}-button`}
          >
            New from template
          </Button>
        }
        emptyState={
          <Box
            sx={{
              border: 1,
              borderStyle: 'dashed',
              borderColor: 'divider',
              borderRadius: 1,
              p: 4,
              textAlign: 'center',
              color: 'text.secondary',
            }}
          >
            <Typography variant="body2" sx={{ mb: 2 }}>
              No {singular}s yet.
            </Typography>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setShowTemplateDialog(true)}
            >
              Create your first {singular}
            </Button>
          </Box>
        }
      />

      {showTemplateDialog && (
        <NewFromTemplateDialog
          targetType={templateTargetType}
          onCancel={() => setShowTemplateDialog(false)}
          onSelect={(template) => {
            setShowTemplateDialog(false);
            setEditor({ kind: 'new', template });
          }}
        />
      )}

      <Dialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        aria-label="Confirm deletion"
        data-testid="confirm-delete-dialog"
      >
        <DialogTitle>Confirm deletion</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Remove <strong>{confirmDelete?.frontmatter.name}</strong>?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteConfirmed}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </Container>
  );
}

function customizationFromTemplate(
  template: Template,
  type: CustomizationType,
): Customization {
  const fm = template.frontmatter;
  return {
    id: '',
    frontmatter: {
      name: fm.name,
      type,
      description: fm.description,
      scopes: fm.scopes ?? ['personal'],
      version: fm.version ?? '0.1.0',
      createdAt: '',
      updatedAt: '',
      ...(fm.tags ? { tags: fm.tags } : {}),
    },
    body: template.body,
  };
}

function duplicateCustomization(
  source: Customization,
  siblings: CustomizationListItem[],
): Customization {
  const taken = new Set(siblings.map((a) => a.frontmatter.name));
  const base = source.frontmatter.name;
  let candidate = `${base}-copy`;
  let i = 2;
  while (taken.has(candidate)) {
    candidate = `${base}-copy-${i}`;
    i++;
  }
  return {
    id: '',
    frontmatter: {
      ...source.frontmatter,
      name: candidate,
      createdAt: '',
      updatedAt: '',
    },
    body: source.body,
  };
}
