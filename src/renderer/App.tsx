import { useState } from 'react';
import type { IpcResult } from '../shared/ipc-contract.js';
import type { Settings } from '../shared/settings.js';

export function App(): React.ReactElement {
  const [result, setResult] = useState<IpcResult<Settings> | null>(null);

  const handleClick = async (): Promise<void> => {
    const next = await window.api.call<Settings>('settings.get', {});
    setResult(next);
  };

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '1.5rem' }}>
      <h1>sde-ai-app — walking skeleton</h1>
      <button type="button" onClick={() => void handleClick()}>
        Get settings
      </button>
      {result === null ? null : result.ok ? (
        <pre data-testid="settings-data">{JSON.stringify(result.data, null, 2)}</pre>
      ) : (
        <p data-testid="settings-error" role="alert">
          [{result.error.kind}] {result.error.message}
        </p>
      )}
    </main>
  );
}
