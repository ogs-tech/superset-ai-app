import { useCallback, useEffect, useState } from 'react';
import { callIpc } from './lib/ipc.js';
import { IoError } from './screens/IoError.js';
import { Main } from './screens/Main.js';
import { Settings as SettingsScreen } from './screens/Settings.js';
import type { Settings } from '../shared/settings.js';

type View =
  | { kind: 'loading' }
  | { kind: 'main'; settings: Settings }
  | { kind: 'settings'; settings: Settings }
  | { kind: 'io-error'; message: string; retry: () => Promise<void> };

export function App(): React.ReactElement {
  const [view, setView] = useState<View>({ kind: 'loading' });

  const bootstrap = useCallback(async (): Promise<void> => {
    try {
      const current = await callIpc<Settings | null>('settings.get', {});
      const settings =
        current ??
        (await callIpc<Settings>('settings.merge', {}));
      setView({ kind: 'main', settings });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'I/O error';
      setView({ kind: 'io-error', message, retry: () => bootstrap() });
    }
  }, []);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  if (view.kind === 'loading') {
    return <main data-testid="loading-screen">Carregando…</main>;
  }

  if (view.kind === 'io-error') {
    return (
      <IoError
        message={view.message}
        onRetry={() => void view.retry()}
        onCancel={() => void bootstrap()}
      />
    );
  }

  if (view.kind === 'settings') {
    return (
      <SettingsScreen
        onBack={() => setView({ kind: 'main', settings: view.settings })}
      />
    );
  }

  return (
    <Main
      onOpenSettings={() => setView({ kind: 'settings', settings: view.settings })}
    />
  );
}
