import { useEffect, useState } from 'react';
import { callIpc, IpcCallError } from '../../lib/ipc.js';
import { Toast, type ToastMessage } from '../../components/Toast.js';
import { NewFromTemplateDialog } from './NewFromTemplateDialog.js';
import { ArtifactEditor } from './ArtifactEditor.js';
import type { Artifact, ArtifactType, Template } from '../../../shared/artifact.js';
import type { SearchOutput } from '../../../shared/search.js';

const TABS: ArtifactType[] = ['skill', 'reference', 'agent', 'global-instruction'];

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
  }
};

interface ArtifactListProps {
  onClose?: () => void;
  searchResults?: SearchOutput | undefined;
}

type Editor =
  | { kind: 'closed' }
  | { kind: 'new'; template: Template; type: ArtifactType }
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
      editor.kind === 'edit'
        ? editor.artifact
        : artifactFromTemplate(editor.template, editor.type);
    return (
      <ArtifactEditor
        initial={initial}
        isCreate={editor.kind === 'new'}
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

      <button type="button" onClick={() => setShowTemplateDialog(true)}>
        Novo a partir de template
      </button>

      {searchResults !== undefined && (
        <p data-testid="search-results-count">
          {searchResults.total} results{searchResults.truncated ? ' (truncated)' : ''}
        </p>
      )}

      {(() => {
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
      ...(typeof fm.includeInCopilotInstructions === 'boolean'
        ? { includeInCopilotInstructions: fm.includeInCopilotInstructions }
        : {}),
    },
    body: template.body,
  };
}
