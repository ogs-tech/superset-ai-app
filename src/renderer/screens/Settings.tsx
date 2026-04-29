import { useEffect, useState } from 'react';
import { callIpc } from '../lib/ipc.js';
import { SyncReportModal } from '../components/SyncReportModal.js';
import type { SyncResult } from '../../shared/artifact.js';
import type {
  LinkedRepoView,
  Settings as SettingsModel,
} from '../../shared/settings.js';

interface SelectFolderResult {
  canceled: boolean;
  path?: string;
}

interface PendingLink {
  path: string;
  branch: string | null;
}

const labelFor = (key: 'claude' | 'copilot'): string =>
  key === 'claude' ? 'Claude' : 'Copilot';

interface SettingsProps {
  onBack?: () => void;
}

export function Settings({ onBack }: SettingsProps = {}): React.ReactElement {
  const [settings, setSettings] = useState<SettingsModel | null>(null);
  const [repos, setRepos] = useState<LinkedRepoView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingLink | null>(null);
  const [syncReport, setSyncReport] = useState<SyncResult[]>([]);

  const refreshRepos = async (): Promise<void> => {
    const list = await callIpc<LinkedRepoView[]>('repo.list', {});
    setRepos(list);
  };

  useEffect(() => {
    void (async () => {
      const current = await callIpc<SettingsModel | null>('settings.get', {});
      if (current !== null) setSettings(current);
      await refreshRepos();
    })();
  }, []);

  const handleAdapterToggle = async (
    key: 'claude' | 'copilot',
    enabled: boolean,
  ): Promise<void> => {
    const next = await callIpc<SettingsModel>('settings.merge', {
      adapters: { [key]: { enabled } },
    });
    setSettings(next);
    const report = enabled
      ? await callIpc<SyncResult[]>('adapter.syncAll', { adapterId: key })
      : await callIpc<SyncResult[]>('adapter.removeAll', { adapterId: key });
    if (report.some((entry) => entry.status !== 'ok')) {
      setSyncReport(report);
    }
  };

  const handleAddRepo = async (): Promise<void> => {
    setError(null);
    try {
      const picked = await callIpc<SelectFolderResult>('dialog.selectFolder', {});
      if (picked.canceled || !picked.path) return;
      const path = picked.path;

      if (repos.some((r) => r.path === path)) {
        setPending({ path, branch: null });
        return;
      }

      const isGit = await callIpc<boolean>('repo.detectGit', { path });
      if (!isGit) {
        setError(`Not a git repository: ${path}`);
        return;
      }

      const branch = await callIpc<string | null>('repo.getCurrentBranch', { path });
      setPending({ path, branch });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'I/O error');
    }
  };

  const handleConfirmLink = async (): Promise<void> => {
    if (pending === null) return;
    try {
      await callIpc<LinkedRepoView>('repo.link', { path: pending.path });
      setPending(null);
      await refreshRepos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'I/O error');
      setPending(null);
    }
  };

  const handleCancelLink = (): void => setPending(null);

  const handleUnlink = async (id: string): Promise<void> => {
    await callIpc('repo.unlink', { id });
    await refreshRepos();
  };

  if (settings === null) {
    return <main data-testid="settings-loading">Carregando…</main>;
  }

  return (
    <main
      data-testid="settings-screen"
      style={{ padding: '1.5rem', fontFamily: 'system-ui, sans-serif' }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Settings</h1>
        {onBack && (
          <button type="button" onClick={onBack}>
            Voltar
          </button>
        )}
      </header>

      <section>
        <h2>Adapters</h2>
        {(['claude', 'copilot'] as const).map((key) => (
          <div key={key} style={{ marginBottom: '0.5rem' }}>
            <input
              id={`adapter-${key}`}
              type="checkbox"
              checked={settings.adapters[key].enabled}
              onChange={(e) =>
                void handleAdapterToggle(key, e.target.checked)
              }
            />
            <label htmlFor={`adapter-${key}`}>{labelFor(key)}</label>
          </div>
        ))}
      </section>

      <section>
        <h2>Linked repos</h2>
        {error !== null ? (
          <p role="alert">{error}</p>
        ) : null}
        <button type="button" onClick={() => void handleAddRepo()}>
          Add repo
        </button>
        <ul>
          {repos.map((repo) => (
            <li key={repo.id} data-testid="linked-repo-item">
              <span>
                <strong>{repo.name}</strong> — <code>{repo.path}</code>
                {repo.branch !== null ? ` (${repo.branch})` : ' (no branch)'}
              </span>
              <button type="button" onClick={() => void handleUnlink(repo.id)}>
                Unlink
              </button>
            </li>
          ))}
        </ul>
      </section>

      {pending !== null ? (
        <div role="dialog" aria-labelledby="link-confirm-title">
          <h2 id="link-confirm-title">Confirmar link de repositório</h2>
          <p>
            Ao linkar <code>{pending.path}</code>, o app poderá criar
            <strong> symlinks </strong> em <code>.claude/</code> e
            <code> .github/</code> dentro do repositório, e essas mudanças
            podem ser <strong>commit</strong>adas se você não as ignorar via
            <code> .gitignore</code>.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" onClick={() => void handleConfirmLink()}>
              Confirmar
            </button>
            <button type="button" onClick={handleCancelLink}>
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
      <SyncReportModal report={syncReport} onClose={() => setSyncReport([])} />
    </main>
  );
}
