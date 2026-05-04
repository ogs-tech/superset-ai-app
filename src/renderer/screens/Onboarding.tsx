import { useState } from 'react';
import { callIpc } from '../lib/ipc.js';
import { getDefaults, getDefaultWorkspacePath } from '../../shared/settings.js';
import type { Settings } from '../../shared/settings.js';

interface OnboardingProps {
  onComplete: (settings: Settings) => void;
  onIoError: (message: string, retry: () => Promise<void>) => void;
}

interface SelectFolderResult {
  canceled: boolean;
  path?: string;
}

export function Onboarding({ onComplete, onIoError }: OnboardingProps): React.ReactElement {
  const [busy, setBusy] = useState(false);

  const persist = async (workspacePath: string): Promise<void> => {
    const apply = async (): Promise<void> => {
      await callIpc('workspace.setActive', { workspacePath });
      await callIpc('workspace.bootstrap', { workspacePath });
      const defaults = getDefaults();
      const next = await callIpc<Settings>('settings.merge', {
        workspacePath,
        adapters: defaults.adapters,
        linkedRepos: defaults.linkedRepos,
        ui: defaults.ui,
      });
      onComplete(next);
    };

    try {
      await apply();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'I/O error';
      onIoError(message, apply);
    }
  };

  const handleSelect = async (): Promise<void> => {
    setBusy(true);
    try {
      const active = await callIpc<string>('workspace.getActive', {});
      const picked = await callIpc<SelectFolderResult>('dialog.selectFolder', {
        defaultPath: active,
      });
      if (picked.canceled || !picked.path) {
        return;
      }
      await persist(picked.path);
    } finally {
      setBusy(false);
    }
  };

  const handleUseDefault = async (): Promise<void> => {
    setBusy(true);
    try {
      const home = await callIpc<string>('app.getHomeDir', {});
      await persist(getDefaultWorkspacePath(home));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main
      data-testid="onboarding-screen"
      style={{ padding: '1.5rem', fontFamily: 'system-ui, sans-serif' }}
    >
      <h1>Bem-vindo ao sde-ai-app</h1>
      <p>
        Selecione a pasta do workspace ou use o padrão <code>~/.sde-ai-app</code>.
      </p>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="button" onClick={() => void handleUseDefault()} disabled={busy}>
          Usar padrão (~/.sde-ai-app)
        </button>
        <button type="button" onClick={() => void handleSelect()} disabled={busy}>
          Selecionar pasta
        </button>
      </div>
    </main>
  );
}
