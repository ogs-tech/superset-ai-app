import { useState } from 'react';
import { ArtifactList } from './artifacts/ArtifactList.js';
import { TopbarSearch } from '../components/TopbarSearch.js';
import type { SearchOutput } from '../../shared/search.js';

interface MainProps {
  onOpenSettings: () => void;
}

export function Main({ onOpenSettings }: MainProps): React.ReactElement {
  const [searchResults, setSearchResults] = useState<SearchOutput | undefined>(undefined);

  return (
    <div data-testid="main-screen">
      <header
        data-testid="topbar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          padding: '0.5rem 1.5rem',
          borderBottom: '1px solid #ddd',
        }}
      >
        <TopbarSearch onResults={setSearchResults} />
        <button type="button" onClick={onOpenSettings}>
          Abrir Settings
        </button>
      </header>
      <ArtifactList searchResults={searchResults} />
    </div>
  );
}
