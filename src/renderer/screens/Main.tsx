import { useState } from 'react';
import { ArtifactList } from './artifacts/ArtifactList.js';
import type { Settings } from '../../shared/settings.js';

interface MainProps {
  settings: Settings;
  onOpenSettings: () => void;
}

export function Main({ settings, onOpenSettings }: MainProps): React.ReactElement {
  const [view, setView] = useState<'home' | 'artifacts'>('home');

  if (view === 'artifacts') {
    return <ArtifactList onClose={() => setView('home')} />;
  }

  return (
    <main
      data-testid="main-screen"
      style={{ padding: '1.5rem', fontFamily: 'system-ui, sans-serif' }}
    >
      <h1>sde-ai-app</h1>
      <p>
        Workspace: <code>{settings.workspacePath}</code>
      </p>
      <button type="button" onClick={onOpenSettings}>
        Abrir Settings
      </button>{' '}
      <button type="button" onClick={() => setView('artifacts')}>
        Abrir Artifacts
      </button>
    </main>
  );
}
