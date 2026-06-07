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
} from '@mui/material';
import { Plus, Pencil, Trash2, Copy, Sparkles } from 'lucide-react';
import { Icon } from './ds/Icon.js';
import { ScreenHeader } from './ds/ScreenHeader.js';
import { EmptyState } from './ds/EmptyState.js';
import { callIpc, IpcCallError } from '../lib/ipc.js';
import { Toast, type ToastMessage } from './Toast.js';
import { PluginOriginBadge } from './PluginOriginBadge.js';
import { CustomizationEditor } from './CustomizationEditor.js';
import { CustomizationViewDrawer } from './CustomizationViewDrawer.js';
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
import { blankCustomization } from '../lib/blank-customization.js';

interface CustomizationListScreenProps {
  entityType: CustomizationType;
  title: string;
  singular: string;
  gender: 'f' | 'm';
  listMethod: string;
  deleteMethod: string;
}

type Editor =
  | { kind: 'closed' }
  | { kind: 'create'; customization: Customization }
  | { kind: 'edit'; customization: Customization };

export function CustomizationListScreen({
  entityType,
  title,
  singular,
  gender,
  listMethod,
  deleteMethod,
}: CustomizationListScreenProps): React.ReactElement {
  const { data, isLoading, error } = useCustomizationList(
    entityType,
    listMethod,
  );
  const invalidate = useInvalidateCustomization();

  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [editor, setEditor] = useState<Editor>({ kind: 'closed' });
  const [confirmDelete, setConfirmDelete] =
    useState<CustomizationListItem | null>(null);
  const [viewing, setViewing] = useState<CustomizationListItem | null>(null);

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
      message: `${saved.frontmatter.name} salvo`,
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
        message: `${confirmDelete.frontmatter.name} removido`,
      });
      await invalidate(entityType);
    } catch (err) {
      const message = err instanceof IpcCallError ? err.message : String(err);
      setToast({ variant: 'error', message });
    } finally {
      setConfirmDelete(null);
    }
  };

  if (editor.kind !== 'closed') {
    return (
      <CustomizationEditor
        initial={editor.customization}
        isCreate={editor.kind === 'create'}
        onSaved={handleSaved}
        onCancel={() => setEditor({ kind: 'closed' })}
      />
    );
  }

  const startCreate = (): void =>
    setEditor({ kind: 'create', customization: blankCustomization(entityType) });

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
        render: (item, view) =>
          view === 'card' && item.source.kind === 'plugin' ? (
            <Stack direction="row" sx={{ alignItems: 'center' }}>
              <Box component="span">{item.frontmatter.name}</Box>
              <PluginOriginBadge
                pluginId={item.source.pluginId}
                {...(item.source.provenance ? { provenance: item.source.provenance } : {})}
              />
            </Stack>
          ) : (
            item.frontmatter.name
          ),
      },
      {
        key: 'plugin',
        label: 'Plugin',
        hideInCard: true,
        width: 160,
        render: (item) =>
          item.source.kind === 'plugin' ? (
            <PluginOriginBadge
              pluginId={item.source.pluginId}
              {...(item.source.provenance ? { provenance: item.source.provenance } : {})}
            />
          ) : null,
      },
      {
        key: 'frontmatter.description',
        label: 'Description',
        secondary: true,
        searchable: true,
      },
    ],
  };

  const isWorkspace = (item: CustomizationListItem): boolean =>
    item.source.kind === 'workspace';

  const actions: RowAction<CustomizationListItem>[] = [
    {
      label: 'Editar',
      icon: <Icon glyph={Pencil} size={16} />,
      hidden: (item) => !isWorkspace(item),
      onClick: (item) =>
        setEditor({
          kind: 'edit',
          customization: toCustomization(item),
        }),
    },
    {
      label: 'Duplicar',
      icon: <Icon glyph={Copy} size={16} />,
      hidden: (item) => !isWorkspace(item),
      onClick: (item) =>
        setEditor({
          kind: 'create',
          customization: duplicateCustomization(toCustomization(item), items),
        }),
    },
    {
      label: 'Excluir',
      icon: <Icon glyph={Trash2} size={16} />,
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
      <ScreenHeader
        kicker="Biblioteca"
        title={title}
        actions={
          <Button
            variant="contained"
            startIcon={<Icon glyph={Plus} size={16} />}
            onClick={startCreate}
            data-testid={`new-${entityType}-button`}
          >
            Novo
          </Button>
        }
      />

      <EntityDataGrid<CustomizationListItem>
        entity={entity}
        data={items}
        isLoading={isLoading}
        error={error}
        actions={actions}
        onRowClick={(item) => setViewing(item)}
        searchPlaceholder={`Buscar ${singular}s…`}
        emptyState={
          <EmptyState
            glyph={Sparkles}
            title={`Nenhum${gender === 'f' ? 'a' : ''} ${singular} ainda`}
            cta={
              <Button
                variant="outlined"
                startIcon={<Icon glyph={Plus} size={16} />}
                onClick={startCreate}
              >
                Criar {singular}
              </Button>
            }
            testId={entityType}
          />
        }
      />

      <Dialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        aria-label="Confirmar exclusão"
        data-testid="confirm-delete-dialog"
      >
        <DialogTitle>Confirmar exclusão</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Remover <strong>{confirmDelete?.frontmatter.name}</strong>?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>Cancelar</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteConfirmed}
          >
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>

      <Toast toast={toast} onDismiss={() => setToast(null)} />

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
    </Container>
  );
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
