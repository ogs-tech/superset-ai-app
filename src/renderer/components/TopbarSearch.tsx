import { useEffect, useRef, useState } from 'react';
import { callIpc } from '../lib/ipc.js';
import type { SearchOutput } from '../../shared/search.js';

interface TopbarSearchProps {
  onResults: (results: SearchOutput | undefined) => void;
}

export function TopbarSearch({ onResults }: TopbarSearchProps): React.ReactElement {
  const [value, setValue] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = (): void => {
    setValue('');
    onResults(undefined);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') clear();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const q = e.target.value;
    setValue(q);

    if (timerRef.current !== null) clearTimeout(timerRef.current);

    if (!q.trim()) {
      onResults(undefined);
      return;
    }

    timerRef.current = setTimeout(() => {
      void callIpc<SearchOutput>('artifact.search', { query: q }).then((out) => {
        onResults(out);
      });
    }, 250);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
      <input
        data-testid="topbar-search-input"
        type="search"
        placeholder="Search artifacts..."
        value={value}
        onChange={handleChange}
      />
      {value && (
        <button
          type="button"
          data-testid="topbar-search-clear"
          onClick={clear}
          aria-label="Clear search"
        >
          X
        </button>
      )}
    </div>
  );
}
