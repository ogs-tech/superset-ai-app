import { useEffect, useState } from 'react';
import { callIpc, IpcCallError } from '../../lib/ipc.js';
import { Toast, type ToastMessage } from '../../components/Toast.js';
import { NewFromTemplateDialog } from './NewFromTemplateDialog.js';
import { ArtifactEditor } from './ArtifactEditor.js';
import type { Artifact, ArtifactType, Template } from '../../../shared/artifact.js';
import type { SearchOutput } from '../../../shared/search.js';

const TABS: ArtifactType[] = ['skill', 'reference', 'agent', 'global-instruction', 'template'];

const GLOBAL_INSTRUCTION_NAME = 'default';

const tabLabel = (type: ArtifactType): string => {
  switch (type) {
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

interface ArtifactListProps {
  onClose?: () => void;
  searchResults?: SearchOutput | undefined;
}

type Editor =
  | { kind: 'closed' }
  | { kind: 'new'; template: Template; type: ArtifactType }
  | { kind: 'create'; artifact: Artifact }
  | { kind: 'edit'; artifact: Artifact };

export function ArtifactList({ onClose, searchResults }: ArtifactListProps = {}): React.ReactElement {
  const [activeTab, setActiveTab] = useState<ArtifactType>('skill');
  const [items, setItems] = useState<Artifact[]>([]);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [editor, setEditor] = useState<Editor>({ kind: 'closed' });
  const [confirmDelete, setConfirmDelete] = useState<Artifact | null>(null);

  const loadList = async (type: ArtifactType): Promise<void> => {
    try {
      const list = await callIpc<Artifact[]>('artifact.list', { type });
      setItems(list);
    } catch (err) {
      const message = err instanceof IpcCallError ? err.message : String(err);
      setToast({ variant: 'error', message });
    }
  };

  useEffect(() => {
    void (async () => {
      await loadList(activeTab);
    })();
  }, [activeTab]);

  const handleSaved = async (saved: Artifact): Promise<void> => {
    setEditor({ kind: 'closed' });
    setToast({ variant: 'success', message: `${saved.frontmatter.name} salvo` });
    await loadList(activeTab);
  };

  const openGlobalInstructionEditor = async (): Promise<void> => {
    const existing = items.find((a) => a.frontmatter.name === GLOBAL_INSTRUCTION_NAME);
    if (existing) {
      setEditor({ kind: 'edit', artifact: existing });
      return;
    }
    try {
      const templates = await callIpc<Template[]>('template.list', { type: 'global-instruction' });
      const template = templates[0];
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
      await callIpc('artifact.delete', {
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

  if (editor.kind !== 'closed') {
    const initial =
      editor.kind === 'edit' || editor.kind === 'create'
        ? editor.artifact
        : artifactFromTemplate(editor.template, editor.type);
    return (
      <ArtifactEditor
        initial={initial}
        isCreate={editor.kind === 'new' || editor.kind === 'create'}
        onSaved={handleSaved}
        onCancel={() => setEditor({ kind: 'closed' })}
      />
    );
  }

  return (
    <main
      data-testid="artifact-list"
      style={{ padding: '1.5rem', fontFamily: 'system-ui, sans-serif' }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Artifacts</h1>
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

      {activeTab !== 'global-instruction' && activeTab !== 'template' && (
        <button type="button" onClick={() => setShowTemplateDialog(true)}>
          Novo a partir de template
        </button>
      )}

      {activeTab === 'template' && (
        <button
          type="button"
          onClick={() =>
            setEditor({ kind: 'create', artifact: blankTemplateArtifact() })
          }
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
      })() : (() => {
        const displayItems = searchResults !== undefined
          ? searchResults.results.map((r) => r.artifact)
          : items;
        return (
          <ul style={{ marginTop: '1rem', listStyle: 'none', padding: 0 }}>
            {displayItems.length === 0 && searchResults !== undefined && <li>No search results.</li>}
            {displayItems.length === 0 && searchResults === undefined && <li>Nenhum {tabLabel(activeTab)} ainda.</li>}
            {displayItems.map((artifact) => (
          <li
            key={artifact.id}
            data-testid={`artifact-item-${artifact.id}`}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '0.5rem 0',
              borderBottom: '1px solid #ddd',
            }}
          >
            <span>
              <strong>{artifact.frontmatter.name}</strong>
            </span>
            <span>
              <button type="button" onClick={() => setEditor({ kind: 'edit', artifact })}>
                Editar
              </button>{' '}
              <button type="button" onClick={() => setConfirmDelete(artifact)}>
                Deletar
              </button>
            </span>
          </li>
            ))}
          </ul>
        );
      })()}

      {showTemplateDialog && (
        <NewFromTemplateDialog
          type={activeTab}
          onCancel={() => setShowTemplateDialog(false)}
          onSelect={(template) => {
            setShowTemplateDialog(false);
            setEditor({ kind: 'new', template, type: activeTab });
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

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </main>
  );
}

function artifactFromTemplate(template: Template, type: ArtifactType): Artifact {
  const fm = template.frontmatter;
  return {
    id: '',
    frontmatter: {
      name: fm.name ?? '',
      type,
      description: fm.description ?? '',
      scopes: fm.scopes ?? ['personal'],
      version: fm.version ?? '0.1.0',
      createdAt: '',
      updatedAt: '',
      ...(fm.tags ? { tags: fm.tags } : {}),
    },
    body: template.body,
  };
}

function blankTemplateArtifact(): Artifact {
  return {
    id: '',
    frontmatter: {
      name: '',
      type: 'template',
      description: '',
      scopes: ['personal'],
      version: '0.1.0',
      targetType: 'skill',
      createdAt: '',
      updatedAt: '',
    },
    body: '',
  };
}
