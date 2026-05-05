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
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { callIpc, IpcCallError } from '../../lib/ipc.js';
import { Toast, type ToastMessage } from '../../components/Toast.js';
import { NewFromTemplateDialog } from './NewFromTemplateDialog.js';
import { CustomizationEditor } from './CustomizationEditor.js';
import { TemplateEditor } from './TemplateEditor.js';
import type {
  Customization,
  CustomizationType,
} from '../../../shared/customization.js';
import type { Template, TemplateTargetType } from '../../../shared/template.js';
import type { SearchOutput } from '../../../shared/search.js';

type TabKey = CustomizationType | 'template';

const TABS: TabKey[] = ['skill', 'reference', 'agent', 'global-instruction', 'template'];

const GLOBAL_INSTRUCTION_NAME = 'default';

const tabLabel = (tab: TabKey): string => {
  switch (tab) {
    case 'skill':
      return 'Skills';
    case 'reference':
      return 'References';
    case 'agent':
      return 'Agents';
    case 'global-instruction':
      return 'Global instructions';
    case 'template':
      return 'Templates';
  }
};

const singularLabel = (tab: CustomizationType): string => {
  switch (tab) {
    case 'skill':
      return 'skill';
    case 'reference':
      return 'reference';
    case 'agent':
      return 'agent';
    case 'global-instruction':
      return 'global instruction';
  }
};

interface CustomizationListProps {
  onClose?: () => void;
  searchResults?: SearchOutput | undefined;
  root?: string;
}

type Editor =
  | { kind: 'closed' }
  | { kind: 'new'; template: Template; type: CustomizationType }
  | { kind: 'create'; customization: Customization }
  | { kind: 'edit'; customization: Customization }
  | { kind: 'template-create'; template: Template }
  | { kind: 'template-edit'; template: Template };

export function CustomizationList({ onClose, searchResults, root }: CustomizationListProps = {}): React.ReactElement {
  const [activeTab, setActiveTab] = useState<TabKey>('skill');
  const [items, setItems] = useState<Customization[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [editor, setEditor] = useState<Editor>({ kind: 'closed' });
  const [confirmDelete, setConfirmDelete] = useState<Customization | null>(null);
  const [confirmDeleteTemplate, setConfirmDeleteTemplate] = useState<Template | null>(null);

  const loadList = async (type: CustomizationType): Promise<void> => {
    try {
      const list = await callIpc<Customization[]>('customization.list', { type, ...(root ? { root } : {}) });
      setItems(list);
    } catch (err) {
      const message = err instanceof IpcCallError ? err.message : String(err);
      setToast({ variant: 'error', message });
    }
  };

  const loadTemplates = async (): Promise<void> => {
    try {
      const list = await callIpc<Template[]>('template.list', {});
      setTemplates(list);
    } catch (err) {
      const message = err instanceof IpcCallError ? err.message : String(err);
      setToast({ variant: 'error', message });
    }
  };

  useEffect(() => {
    void (async () => {
      if (activeTab === 'template') {
        await loadTemplates();
      } else {
        await loadList(activeTab);
      }
    })();
  }, [activeTab]);

  const handleSaved = async (saved: Customization): Promise<void> => {
    setEditor({ kind: 'closed' });
    setToast({ variant: 'success', message: `${saved.frontmatter.name} saved` });
    if (activeTab !== 'template') await loadList(activeTab);
  };

  const handleTemplateSaved = async (saved: Template): Promise<void> => {
    setEditor({ kind: 'closed' });
    setToast({ variant: 'success', message: `${saved.frontmatter.name} saved` });
    await loadTemplates();
  };

  const openGlobalInstructionEditor = async (): Promise<void> => {
    const existing = items.find((a) => a.frontmatter.name === GLOBAL_INSTRUCTION_NAME);
    if (existing) {
      setEditor({ kind: 'edit', customization: existing });
      return;
    }
    try {
      const list = await callIpc<Template[]>('template.list', { targetType: 'global-instruction' });
      const template = list[0];
      if (!template) {
        setToast({
          variant: 'error',
          message: 'global-instruction template not found',
        });
        return;
      }
      setEditor({ kind: 'new', template, type: 'global-instruction' });
    } catch (err) {
      const message = err instanceof IpcCallError ? err.message : String(err);
      setToast({ variant: 'error', message });
    }
  };

  const handleDeleteConfirmed = async (): Promise<void> => {
    if (!confirmDelete) return;
    try {
      await callIpc('customization.delete', {
        id: confirmDelete.id,
        removeSymlinks: true,
        ...(root ? { root } : {}),
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

  const handleDeleteTemplateConfirmed = async (): Promise<void> => {
    if (!confirmDeleteTemplate) return;
    try {
      await callIpc('template.delete', { id: confirmDeleteTemplate.id });
      setTemplates((prev) => prev.filter((t) => t.id !== confirmDeleteTemplate.id));
      setToast({
        variant: 'success',
        message: `${confirmDeleteTemplate.frontmatter.name} removed`,
      });
    } catch (err) {
      const message = err instanceof IpcCallError ? err.message : String(err);
      setToast({ variant: 'error', message });
    } finally {
      setConfirmDeleteTemplate(null);
    }
  };

  if (editor.kind === 'template-create' || editor.kind === 'template-edit') {
    return (
      <TemplateEditor
        initial={editor.template}
        isCreate={editor.kind === 'template-create'}
        onSaved={handleTemplateSaved}
        onCancel={() => setEditor({ kind: 'closed' })}
      />
    );
  }

  if (editor.kind !== 'closed') {
    const initial =
      editor.kind === 'edit' || editor.kind === 'create'
        ? editor.customization
        : customizationFromTemplate(editor.template, editor.type);
    return (
      <CustomizationEditor
        initial={initial}
        isCreate={editor.kind === 'new' || editor.kind === 'create'}
        onSaved={handleSaved}
        onCancel={() => setEditor({ kind: 'closed' })}
        {...(root ? { root } : {})}
      />
    );
  }

  const isTemplateTab = activeTab === 'template';
  const isCustomizationTabWithPicker =
    activeTab !== 'global-instruction' && activeTab !== 'template';

  return (
    <Container
      component="main"
      data-testid="customization-list"
      maxWidth="md"
      sx={{ py: 4 }}
    >
      <Stack
        direction="row"
        sx={{ mb: 3, justifyContent: 'space-between', alignItems: 'center' }}
      >
        <Typography variant="h4" component="h1">
          Customizations
        </Typography>
        {onClose && (
          <Button variant="text" startIcon={<ArrowBackIcon />} onClick={onClose}>
            Back
          </Button>
        )}
      </Stack>

      <Tabs
        value={activeTab}
        onChange={(_, value: TabKey) => setActiveTab(value)}
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
        variant="scrollable"
        scrollButtons="auto"
      >
        {TABS.map((tab) => (
          <Tab key={tab} value={tab} label={tabLabel(tab)} />
        ))}
      </Tabs>

      {(isCustomizationTabWithPicker || isTemplateTab) && (
        <Box sx={{ mb: 2 }}>
          {isCustomizationTabWithPicker && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setShowTemplateDialog(true)}
            >
              New from template
            </Button>
          )}
          {isTemplateTab && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setEditor({ kind: 'template-create', template: blankTemplate() })}
              data-testid="new-template-button"
            >
              New template
            </Button>
          )}
        </Box>
      )}

      {searchResults !== undefined && (
        <Typography
          data-testid="search-results-count"
          variant="body2"
          color="text.secondary"
          sx={{ mb: 1 }}
        >
          {searchResults.total} results{searchResults.truncated ? ' (truncated)' : ''}
        </Typography>
      )}

      {activeTab === 'global-instruction' && searchResults === undefined ? (() => {
        const existing = items.find((a) => a.frontmatter.name === GLOBAL_INSTRUCTION_NAME);
        return (
          <List data-testid="global-instruction-slots" disablePadding>
            <ListItem
              data-testid="global-instruction-slot"
              divider
              secondaryAction={
                <Button
                  size="small"
                  startIcon={<EditIcon fontSize="small" />}
                  onClick={() => void openGlobalInstructionEditor()}
                >
                  Edit
                </Button>
              }
            >
              <ListItemText
                primary={<Box component="strong">Global instructions</Box>}
                secondary={existing ? '(configured)' : '(not configured)'}
              />
            </ListItem>
          </List>
        );
      })() : isTemplateTab && searchResults === undefined ? (
        <List data-testid="template-list" disablePadding>
          {templates.length === 0 && (
            <EmptyState
              message="No templates yet."
              ctaLabel="Create your first template"
              onCta={() => setEditor({ kind: 'template-create', template: blankTemplate() })}
            />
          )}
          {templates.map((tpl) => (
            <ListItem
              key={tpl.id}
              data-testid={`template-item-${tpl.id}`}
              divider
              secondaryAction={
                <Stack direction="row" spacing={0.5}>
                  <Tooltip title="Edit">
                    <IconButton
                      size="small"
                      onClick={() => setEditor({ kind: 'template-edit', template: tpl })}
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
                          kind: 'template-create',
                          template: duplicateTemplate(tpl, templates),
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
                      onClick={() => setConfirmDeleteTemplate(tpl)}
                      aria-label="Delete"
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              }
            >
              <ListItemText
                primary={<Box component="strong">{tpl.frontmatter.name}</Box>}
                secondary={`(${tpl.frontmatter.targetType})`}
              />
            </ListItem>
          ))}
        </List>
      ) : (() => {
        const displayItems = searchResults !== undefined
          ? searchResults.results.map((r) => r.customization)
          : items;
        return (
          <List disablePadding>
            {displayItems.length === 0 && searchResults !== undefined && (
              <EmptyState message="No search results." />
            )}
            {displayItems.length === 0 && searchResults === undefined && (
              <EmptyState
                message={`No ${singularLabel(activeTab as CustomizationType)}s yet.`}
                ctaLabel={`Create your first ${singularLabel(activeTab as CustomizationType)}`}
                onCta={() => setShowTemplateDialog(true)}
              />
            )}
            {displayItems.map((customization) => (
              <ListItem
                key={customization.id}
                data-testid={`customization-item-${customization.id}`}
                divider
                secondaryAction={
                  <Stack direction="row" spacing={0.5}>
                    <Tooltip title="Edit">
                      <IconButton
                        size="small"
                        onClick={() => setEditor({ kind: 'edit', customization })}
                        aria-label="Edit"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Duplicate">
                      <IconButton
                        size="small"
                        onClick={() =>
                          setEditor({ kind: 'create', customization: duplicateCustomization(customization, items) })
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
                        onClick={() => setConfirmDelete(customization)}
                        aria-label="Delete"
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                }
              >
                <ListItemText primary={<Box component="strong">{customization.frontmatter.name}</Box>} />
              </ListItem>
            ))}
          </List>
        );
      })()}

      {showTemplateDialog && isCustomizationTabWithPicker && (
        <NewFromTemplateDialog
          targetType={activeTab as TemplateTargetType}
          onCancel={() => setShowTemplateDialog(false)}
          onSelect={(template) => {
            setShowTemplateDialog(false);
            setEditor({ kind: 'new', template, type: activeTab as CustomizationType });
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

      <Dialog
        open={confirmDeleteTemplate !== null}
        onClose={() => setConfirmDeleteTemplate(null)}
        aria-label="Confirm template deletion"
        data-testid="confirm-delete-template-dialog"
      >
        <DialogTitle>Confirm template deletion</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Remove template <strong>{confirmDeleteTemplate?.frontmatter.name}</strong>?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteTemplate(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDeleteTemplateConfirmed}>
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

function customizationFromTemplate(template: Template, type: CustomizationType): Customization {
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

function duplicateCustomization(source: Customization, siblings: Customization[]): Customization {
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

function duplicateTemplate(source: Template, siblings: Template[]): Template {
  const taken = new Set(siblings.map((t) => t.frontmatter.name));
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

function blankTemplate(): Template {
  return {
    id: '',
    frontmatter: {
      name: '',
      targetType: 'skill',
      description: '',
      scopes: ['personal'],
      version: '0.1.0',
      createdAt: '',
      updatedAt: '',
    },
    body: '',
  };
}
