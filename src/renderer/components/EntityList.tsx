import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  Tooltip,
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
import type {
  Customization,
  CustomizationType,
} from '../../shared/customization.js';
import type { Template, TemplateTargetType } from '../../shared/template.js';

interface EntityWithSource {
  id: string;
  frontmatter: { name: string } & Record<string, unknown>;
  body: string;
  source: { kind: 'workspace' } | { kind: 'plugin'; pluginId: string };
}

interface EntityListProps {
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
  | { kind: 'view'; entity: EntityWithSource };

export function EntityList({
  entityType,
  templateTargetType,
  title,
  singular,
  listMethod,
  deleteMethod,
}: EntityListProps): React.ReactElement {
  const [items, setItems] = useState<EntityWithSource[]>([]);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [editor, setEditor] = useState<Editor>({ kind: 'closed' });
  const [confirmDelete, setConfirmDelete] = useState<EntityWithSource | null>(null);

  const load = async (): Promise<void> => {
    try {
      const list = await callIpc<EntityWithSource[]>(listMethod, { scope: 'personal' });
      setItems(Array.isArray(list) ? list : []);
    } catch (err) {
      const message = err instanceof IpcCallError ? err.message : String(err);
      setToast({ variant: 'error', message });
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listMethod]);

  const toCustomization = (entity: EntityWithSource): Customization => ({
    id: `${entityType}/${entity.frontmatter.name}`,
    frontmatter: { ...entity.frontmatter, type: entityType } as Customization['frontmatter'],
    body: entity.body,
  });

  const handleSaved = async (saved: Customization): Promise<void> => {
    setEditor({ kind: 'closed' });
    setToast({ variant: 'success', message: `${saved.frontmatter.name} saved` });
    await load();
  };

  const handleDeleteConfirmed = async (): Promise<void> => {
    if (!confirmDelete) return;
    try {
      await callIpc(deleteMethod, {
        id: confirmDelete.frontmatter.name,
        removeSymlinks: true,
      });
      setItems((prev) => prev.filter((a) => a.id !== confirmDelete.id));
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

  return (
    <Container
      component="main"
      data-testid={`entity-list-${entityType}`}
      maxWidth="md"
      sx={{ py: 4 }}
    >
      <Stack
        direction="row"
        sx={{ mb: 3, justifyContent: 'space-between', alignItems: 'center' }}
      >
        <Typography variant="h4" component="h1">
          {title}
        </Typography>
      </Stack>

      <Box sx={{ mb: 2 }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setShowTemplateDialog(true)}
          data-testid={`new-${entityType}-button`}
        >
          New from template
        </Button>
      </Box>

      <List disablePadding>
        {items.length === 0 && (
          <EmptyState
            message={`No ${singular}s yet.`}
            ctaLabel={`Create your first ${singular}`}
            onCta={() => setShowTemplateDialog(true)}
          />
        )}
        {items.map((item) => {
          const isPlugin = item.source.kind === 'plugin';
          const pluginId = isPlugin && item.source.kind === 'plugin' ? item.source.pluginId : null;
          return (
            <ListItem
              key={`${item.source.kind}/${item.id}`}
              data-testid={`${entityType}-item-${item.id}`}
              divider
              secondaryAction={
                <Stack direction="row" spacing={0.5}>
                  {isPlugin ? (
                    <Tooltip title="View (read-only)">
                      <IconButton
                        size="small"
                        onClick={() => setEditor({ kind: 'view', entity: item })}
                        aria-label="View"
                      >
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  ) : (
                    <>
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          onClick={() =>
                            setEditor({ kind: 'edit', customization: toCustomization(item) })
                          }
                          aria-label="Edit"
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Duplicate">
                        <IconButton
                          size="small"
                          onClick={() =>
                            setEditor({
                              kind: 'create',
                              customization: duplicateCustomization(toCustomization(item), items),
                            })
                          }
                          aria-label="Duplicate"
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => setConfirmDelete(item)}
                          aria-label="Delete"
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </>
                  )}
                </Stack>
              }
            >
              <ListItemText
                primary={
                  <Stack direction="row" sx={{ alignItems: 'center' }}>
                    <Box component="strong">{item.frontmatter.name}</Box>
                    {pluginId && <PluginOriginBadge pluginId={pluginId} />}
                  </Stack>
                }
              />
            </ListItem>
          );
        })}
      </List>

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
          <Button variant="contained" color="error" onClick={handleDeleteConfirmed}>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </Container>
  );
}

interface EmptyStateProps {
  message: string;
  ctaLabel?: string;
  onCta?: () => void;
}

function EmptyState({ message, ctaLabel, onCta }: EmptyStateProps): React.ReactElement {
  return (
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
      <Typography variant="body2" sx={{ mb: ctaLabel ? 2 : 0 }}>
        {message}
      </Typography>
      {ctaLabel && onCta && (
        <Button variant="outlined" startIcon={<AddIcon />} onClick={onCta}>
          {ctaLabel}
        </Button>
      )}
    </Box>
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

function duplicateCustomization(source: Customization, siblings: EntityWithSource[]): Customization {
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
