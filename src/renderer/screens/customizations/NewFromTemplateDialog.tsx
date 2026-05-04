import { useEffect, useState } from 'react';
import { callIpc, IpcCallError } from '../../lib/ipc.js';
import type { Template, TemplateTargetType } from '../../../shared/template.js';

interface NewFromTemplateDialogProps {
  targetType: TemplateTargetType;
  onSelect: (template: Template) => void;
  onCancel: () => void;
}

export function NewFromTemplateDialog({
  targetType,
  onSelect,
  onCancel,
}: NewFromTemplateDialogProps): React.ReactElement {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const list = await callIpc<Template[]>('template.list', { targetType });
        setTemplates(list);
      } catch (err) {
        const message = err instanceof IpcCallError ? err.message : String(err);
        setError(message);
      }
    })();
  }, [targetType]);

  return (
    <div
      role="dialog"
      aria-label="Selecionar template"
      data-testid="template-dialog"
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'white',
        border: '1px solid #ccc',
        padding: '1.5rem',
        minWidth: 360,
      }}
    >
      <h2>Escolher template ({targetType})</h2>
      {error && <p role="alert">{error}</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {templates.map((tpl) => (
          <li key={tpl.id} style={{ padding: '0.5rem 0' }}>
            <button type="button" onClick={() => onSelect(tpl)}>
              <strong>{tpl.frontmatter.name}</strong> — {tpl.frontmatter.description}
            </button>
          </li>
        ))}
        {templates.length === 0 && !error && <li>Nenhum template encontrado.</li>}
      </ul>
      <button type="button" onClick={onCancel}>
        Cancelar
      </button>
    </div>
  );
}
