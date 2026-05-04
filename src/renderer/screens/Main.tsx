import { useEffect, useState } from 'react';
import { callIpc } from '../lib/ipc.js';
import { ArtifactList } from './artifacts/ArtifactList.js';
import { TopbarSearch } from '../components/TopbarSearch.js';
import type { LinkedRepoView } from '../../shared/settings.js';
import type { SearchOutput } from '../../shared/search.js';

interface SelectFolderResult {
  canceled: boolean;
  path?: string;
}

interface PendingLink {
  path: string;
  branch: string | null;
}

interface MainProps {
  onOpenSettings: () => void;
}

export function Main({ onOpenSettings }: MainProps): React.ReactElement {
  const [view, setView] = useState<'home' | 'artifacts'>('home');
  const [searchResults, setSearchResults] = useState<SearchOutput | undefined>(undefined);
  const [repos, setRepos] = useState<LinkedRepoView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingLink | null>(null);

  const refreshRepos = async (): Promise<void> => {
    const list = await callIpc<LinkedRepoView[]>('repo.list', {});
    setRepos(list);
  };

  useEffect(() => {
    void refreshRepos();
  }, []);

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
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>sde-ai-app</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" onClick={() => setView('artifacts')}>
            Abrir Artifacts
          </button>
          <button type="button" onClick={onOpenSettings}>
            Abrir Settings
          </button>
        </div>
      </header>

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
    </main>
  );
}
