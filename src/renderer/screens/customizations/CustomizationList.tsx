import { useEffect, useState } from 'react';
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

type Tab = CustomizationType | 'template';

const TABS: Tab[] = ['skill', 'reference', 'agent', 'global-instruction', 'template'];

const GLOBAL_INSTRUCTION_NAME = 'default';

const tabLabel = (tab: Tab): string => {
  switch (tab) {
    case 'skill':
      return 'skills';
    case 'reference':
      return 'references';
    case 'agent':
      return 'agents';
    case 'global-instruction':
      return 'global instructions';
    case 'template':
      return 'templates';
  }
};

interface CustomizationListProps {
  onClose?: () => void;
  searchResults?: SearchOutput | undefined;
}

type Editor =
  | { kind: 'closed' }
  | { kind: 'new'; template: Template; type: CustomizationType }
  | { kind: 'create'; customization: Customization }
  | { kind: 'edit'; customization: Customization }
  | { kind: 'template-create'; template: Template }
  | { kind: 'template-edit'; template: Template };

export function CustomizationList({ onClose, searchResults }: CustomizationListProps = {}): React.ReactElement {
  const [activeTab, setActiveTab] = useState<Tab>('skill');
  const [items, setItems] = useState<Customization[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [editor, setEditor] = useState<Editor>({ kind: 'closed' });
  const [confirmDelete, setConfirmDelete] = useState<Customization | null>(null);
  const [confirmDeleteTemplate, setConfirmDeleteTemplate] = useState<Template | null>(null);

  const loadList = async (type: CustomizationType): Promise<void> => {
    try {
      const list = await callIpc<Customization[]>('customization.list', { type });
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
    setToast({ variant: 'success', message: `${saved.frontmatter.name} salvo` });
    if (activeTab !== 'template') await loadList(activeTab);
  };

  const handleTemplateSaved = async (saved: Template): Promise<void> => {
    setEditor({ kind: 'closed' });
    setToast({ variant: 'success', message: `${saved.frontmatter.name} salvo` });
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
          message: 'Template global-instruction não encontrado',
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
      });
      setItems((prev) => prev.filter((a) => a.id !== confirmDelete.id));
      setToast({
        variant: 'success',
        message: `${confirmDelete.frontmatter.name} removido`,
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
        message: `${confirmDeleteTemplate.frontmatter.name} removido`,
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
      />
    );
  }

  const isTemplateTab = activeTab === 'template';
  const isCustomizationTabWithPicker =
    activeTab !== 'global-instruction' && activeTab !== 'template';

  return (
    <main
      data-testid="customization-list"
      style={{ padding: '1.5rem', fontFamily: 'system-ui, sans-serif' }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Customizations</h1>
        {onClose && (
          <button type="button" onClick={onClose}>
            Voltar
          </button>
        )}
      </header>

      <nav role="tablist" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={tab === activeTab}
            onClick={() => setActiveTab(tab)}
            style={{
              fontWeight: tab === activeTab ? 'bold' : 'normal',
              textTransform: 'capitalize',
            }}
          >
            {tabLabel(tab)}
          </button>
        ))}
      </nav>

      {isCustomizationTabWithPicker && (
        <button type="button" onClick={() => setShowTemplateDialog(true)}>
          Novo a partir de template
        </button>
      )}

      {isTemplateTab && (
        <button
          type="button"
          onClick={() => setEditor({ kind: 'template-create', template: blankTemplate() })}
          data-testid="new-template-button"
        >
          Novo template
        </button>
      )}

      {searchResults !== undefined && (
        <p data-testid="search-results-count">
          {searchResults.total} results{searchResults.truncated ? ' (truncated)' : ''}
        </p>
      )}

      {activeTab === 'global-instruction' && searchResults === undefined ? (() => {
        const existing = items.find((a) => a.frontmatter.name === GLOBAL_INSTRUCTION_NAME);
        return (
          <ul
            data-testid="global-instruction-slots"
            style={{ marginTop: '1rem', listStyle: 'none', padding: 0 }}
          >
            <li
              data-testid="global-instruction-slot"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '0.5rem 0',
                borderBottom: '1px solid #ddd',
              }}
            >
              <span>
                <strong>Global instructions</strong>{' '}
                <small>{existing ? '(configurado)' : '(não configurado)'}</small>
              </span>
              <span>
                <button type="button" onClick={() => void openGlobalInstructionEditor()}>
                  Editar
                </button>
              </span>
            </li>
          </ul>
        );
      })() : isTemplateTab && searchResults === undefined ? (
        <ul
          data-testid="template-list"
          style={{ marginTop: '1rem', listStyle: 'none', padding: 0 }}
        >
          {templates.length === 0 && <li>Nenhum template ainda.</li>}
          {templates.map((tpl) => (
            <li
              key={tpl.id}
              data-testid={`template-item-${tpl.id}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '0.5rem 0',
                borderBottom: '1px solid #ddd',
              }}
            >
              <span>
                <strong>{tpl.frontmatter.name}</strong>{' '}
                <small>({tpl.frontmatter.targetType})</small>
              </span>
              <span>
                <button
                  type="button"
                  onClick={() => setEditor({ kind: 'template-edit', template: tpl })}
                >
                  Editar
                </button>{' '}
                <button
                  type="button"
                  onClick={() =>
                    setEditor({
                      kind: 'template-create',
                      template: duplicateTemplate(tpl, templates),
                    })
                  }
                >
                  Duplicar
                </button>{' '}
                <button type="button" onClick={() => setConfirmDeleteTemplate(tpl)}>
                  Deletar
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (() => {
        const displayItems = searchResults !== undefined
          ? searchResults.results.map((r) => r.customization)
          : items;
        return (
          <ul style={{ marginTop: '1rem', listStyle: 'none', padding: 0 }}>
            {displayItems.length === 0 && searchResults !== undefined && <li>No search results.</li>}
            {displayItems.length === 0 && searchResults === undefined && (
              <li>Nenhum {tabLabel(activeTab)} ainda.</li>
            )}
            {displayItems.map((customization) => (
              <li
                key={customization.id}
                data-testid={`customization-item-${customization.id}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '0.5rem 0',
                  borderBottom: '1px solid #ddd',
                }}
              >
                <span>
                  <strong>{customization.frontmatter.name}</strong>
                </span>
                <span>
                  <button type="button" onClick={() => setEditor({ kind: 'edit', customization })}>
                    Editar
                  </button>{' '}
                  <button
                    type="button"
                    onClick={() =>
                      setEditor({ kind: 'create', customization: duplicateCustomization(customization, items) })
                    }
                  >
                    Duplicar
                  </button>{' '}
                  <button type="button" onClick={() => setConfirmDelete(customization)}>
                    Deletar
                  </button>
                </span>
              </li>
            ))}
          </ul>
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

      {confirmDelete && (
        <div role="dialog" aria-label="Confirmar exclusão" data-testid="confirm-delete-dialog">
          <p>
            Remover <strong>{confirmDelete.frontmatter.name}</strong>?
          </p>
          <button type="button" onClick={handleDeleteConfirmed}>
            Confirmar
          </button>
          <button type="button" onClick={() => setConfirmDelete(null)}>
            Cancelar
          </button>
        </div>
      )}

      {confirmDeleteTemplate && (
        <div
          role="dialog"
          aria-label="Confirmar exclusão de template"
          data-testid="confirm-delete-template-dialog"
        >
          <p>
            Remover template <strong>{confirmDeleteTemplate.frontmatter.name}</strong>?
          </p>
          <button type="button" onClick={handleDeleteTemplateConfirmed}>
            Confirmar
          </button>
          <button type="button" onClick={() => setConfirmDeleteTemplate(null)}>
            Cancelar
          </button>
        </div>
      )}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </main>
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
