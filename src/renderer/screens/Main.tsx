import type { Settings } from '../../shared/settings.js';

interface MainProps {
  settings: Settings;
  onOpenSettings: () => void;
}

export function Main({ settings, onOpenSettings }: MainProps): React.ReactElement {
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
      </button>
    </main>
  );
}
