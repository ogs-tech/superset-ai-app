import { useState } from 'react';
import { ArtifactList } from './artifacts/ArtifactList.js';
import { TopbarSearch } from '../components/TopbarSearch.js';
import type { Settings } from '../../shared/settings.js';
import type { SearchOutput } from '../../shared/search.js';

interface MainProps {
  settings: Settings;
  onOpenSettings: () => void;
}

export function Main({ settings, onOpenSettings }: MainProps): React.ReactElement {
  const [view, setView] = useState<'home' | 'artifacts'>('home');
  const [searchResults, setSearchResults] = useState<SearchOutput | undefined>(undefined);

  if (view === 'artifacts') {
    return (
      <div>
        <header
          data-testid="topbar"
          style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.5rem 1.5rem', borderBottom: '1px solid #ddd' }}
        >
          <TopbarSearch onResults={setSearchResults} />
        </header>
        <ArtifactList onClose={() => setView('home')} searchResults={searchResults} />
      </div>
    );
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
