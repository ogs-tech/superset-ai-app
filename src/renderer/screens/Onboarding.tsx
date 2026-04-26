import { useState } from 'react';
import { callIpc } from '../lib/ipc.js';
import { getDefaults } from '../../shared/settings.js';
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

  const handleSelect = async (): Promise<void> => {
    setBusy(true);
    try {
      const picked = await callIpc<SelectFolderResult>('dialog.selectFolder', {
        defaultPath: '~/sde-ai-app',
      });
      if (picked.canceled || !picked.path) {
        setBusy(false);
        return;
      }

      const workspacePath = picked.path;
      const apply = async (): Promise<void> => {
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
        Selecione a pasta do workspace. Sugestão: <code>~/sde-ai-app</code>.
      </p>
      <button type="button" onClick={() => void handleSelect()} disabled={busy}>
        Selecionar pasta
      </button>
    </main>
  );
}
