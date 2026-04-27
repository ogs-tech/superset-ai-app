import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { callIpc, IpcCallError } from '../../lib/ipc.js';
import { Toast, type ToastMessage } from '../../components/Toast.js';
import { SyncReportModal } from '../../components/SyncReportModal.js';
import type {
  Artifact,
  ArtifactFrontmatter,
  ArtifactScope,
  SyncResult,
} from '../../../shared/artifact.js';

interface ArtifactEditorProps {
  initial: Artifact;
  isCreate: boolean;
  onSaved: (artifact: Artifact) => void | Promise<void>;
  onCancel: () => void;
}

const slugify = (input: string): string =>
  input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');

export function ArtifactEditor({
  initial,
  isCreate,
  onSaved,
  onCancel,
}: ArtifactEditorProps): React.ReactElement {
  const [frontmatter, setFrontmatter] = useState<ArtifactFrontmatter>(initial.frontmatter);
  const [body, setBody] = useState(initial.body);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncReport, setSyncReport] = useState<SyncResult[]>([]);

  const update = <K extends keyof ArtifactFrontmatter>(
    key: K,
    value: ArtifactFrontmatter[K],
  ): void => {
    setFrontmatter((fm) => ({ ...fm, [key]: value }));
  };

  const handleNameChange = (value: string): void => {
    setFrontmatter((fm) => ({
      ...fm,
      name: value,
      slug: isCreate && (!fm.slug || fm.slug === slugify(fm.name)) ? slugify(value) : fm.slug,
    }));
  };

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    try {
      const result = await callIpc<{ artifact: Artifact; syncReport: SyncResult[] }>(
        'artifact.save',
        {
          artifact: { id: initial.id, frontmatter, body },
          isCreate,
        },
      );
      setToast({ variant: 'success', message: `${result.artifact.frontmatter.name} salvo` });
      if (result.syncReport.some((entry) => entry.status !== 'ok')) {
        setSyncReport(result.syncReport);
      }
      await onSaved(result.artifact);
    } catch (err) {
      const message = err instanceof IpcCallError ? err.message : String(err);
      setToast({ variant: 'error', message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <main
      data-testid="artifact-editor"
      style={{ padding: '1.5rem', fontFamily: 'system-ui, sans-serif' }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h1>{isCreate ? 'Novo artifact' : `Editar ${initial.frontmatter.name}`}</h1>
        <span>
          <button type="button" onClick={onCancel}>
            Cancelar
          </button>{' '}
          <button type="button" onClick={handleSave} disabled={saving}>
            Salvar
          </button>
        </span>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <fieldset>
          <legend>Frontmatter</legend>
          <label style={{ display: 'block' }}>
            Nome
            <input
              type="text"
              value={frontmatter.name}
              onChange={(e) => handleNameChange(e.target.value)}
            />
          </label>
          <label style={{ display: 'block' }}>
            Slug
            <input
              type="text"
              value={frontmatter.slug}
              onChange={(e) => update('slug', e.target.value)}
            />
          </label>
          <label style={{ display: 'block' }}>
            Descrição
            <input
              type="text"
              value={frontmatter.description}
              onChange={(e) => update('description', e.target.value)}
              maxLength={200}
            />
          </label>
          <label style={{ display: 'block' }}>
            Versão
            <input
              type="text"
              value={frontmatter.version}
              onChange={(e) => update('version', e.target.value)}
            />
          </label>
          <label style={{ display: 'block' }}>
            Escopo
            <select
              value={frontmatter.scope}
              onChange={(e) => update('scope', e.target.value as ArtifactScope)}
            >
              <option value="personal">personal</option>
              <option value="project">project</option>
            </select>
          </label>
        </fieldset>

        <fieldset>
          <legend>Body</legend>
          <textarea
            data-testid="body-textarea"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            style={{ width: '100%', minHeight: 240, fontFamily: 'monospace' }}
          />
        </fieldset>
      </section>

      <section style={{ marginTop: '1rem' }}>
        <h2>Preview</h2>
        <div data-testid="markdown-preview">
          <ReactMarkdown>{body}</ReactMarkdown>
        </div>
      </section>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
      <SyncReportModal report={syncReport} onClose={() => setSyncReport([])} />
    </main>
  );
}
