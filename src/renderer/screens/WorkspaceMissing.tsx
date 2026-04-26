import { useState } from 'react';
import { callIpc } from '../lib/ipc.js';
import type { Settings } from '../../shared/settings.js';

interface WorkspaceMissingProps {
  onResolved: (settings: Settings) => void;
  onCancel: () => void;
}

interface SelectFolderResult {
  canceled: boolean;
  path?: string;
}

export function WorkspaceMissing({
  onResolved,
  onCancel,
}: WorkspaceMissingProps): React.ReactElement {
  const [error, setError] = useState<string | null>(null);

  const handleReselect = async (): Promise<void> => {
    try {
      const picked = await callIpc<SelectFolderResult>('dialog.selectFolder', {});
      if (picked.canceled || !picked.path) return;
      const next = await callIpc<Settings>('settings.merge', {
        workspacePath: picked.path,
      });
      onResolved(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'I/O error');
    }
  };

  return (
    <main
      data-testid="workspace-missing-screen"
      style={{ padding: '1.5rem', fontFamily: 'system-ui, sans-serif' }}
    >
      <h1>Workspace não encontrado</h1>
      <p>O caminho salvo nas configurações não existe mais.</p>
      {error !== null ? <p role="alert">{error}</p> : null}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="button" onClick={() => void handleReselect()}>
          Re-selecionar pasta
        </button>
        <button type="button" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </main>
  );
}
