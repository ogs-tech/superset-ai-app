import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormGroup,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { ArrowLeft, Unlink, Plus, Info } from 'lucide-react';
import { Icon } from '../components/ds/Icon.js';
import { Kicker } from '../components/ds/Kicker.js';
import { ScreenHeader } from '../components/ds/ScreenHeader.js';
import { callIpc, IpcCallError } from '../lib/ipc.js';
import { SyncReportModal } from '../components/SyncReportModal.js';
import { ConfirmDisableModal } from './settings/ConfirmDisableModal.js';
import { RestoreConfirmDialog } from './settings/RestoreConfirmDialog.js';
import type { SyncResult } from '../../shared/sync-result.js';
import type { LanguagePreference, LinkedRepoView, Settings as SettingsModel } from '../../shared/settings.js';

const LANGUAGE_OPTIONS: { value: LanguagePreference; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'mirror', label: 'Mirror (same as user)' },
  { value: 'pt-BR', label: 'Português (pt-BR)' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
];

const ADAPTER_KEYS = ['claude', 'cursor'] as const;
type AdapterKey = (typeof ADAPTER_KEYS)[number];
const ADAPTER_LABEL: Record<AdapterKey, string> = { claude: 'Claude', cursor: 'Cursor' };

interface SelectFolderResult {
  canceled: boolean;
  path?: string;
}

interface PendingLink {
  path: string;
  branch: string | null;
}

interface SettingsProps {
  onBack?: () => void;
}

export function Settings({ onBack }: SettingsProps = {}): React.ReactElement {
  const [settings, setSettings] = useState<SettingsModel | null>(null);
  const [syncReport, setSyncReport] = useState<SyncResult[]>([]);
  const [disableModal, setDisableModal] = useState<{
    key: AdapterKey;
    count: number;
  } | null>(null);
  const [disableToast, setDisableToast] = useState<string | null>(null);
  const [repos, setRepos] = useState<LinkedRepoView[]>([]);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingLink | null>(null);
  const [patValue, setPatValue] = useState('');
  const [patHasToken, setPatHasToken] = useState(false);
  const [patLoading, setPatLoading] = useState(false);
  const [patError, setPatError] = useState<string | null>(null);
  const [patSuccess, setPatSuccess] = useState(false);
  const [safeStorageUnavailable, setSafeStorageUnavailable] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [languageLoading, setLanguageLoading] = useState(false);

  const handleLanguageChange = async (language: LanguagePreference): Promise<void> => {
    setLanguageLoading(true);
    try {
      const result = await callIpc<{ settings: SettingsModel; syncReport: SyncResult[] }>(
        'settings.setLanguage',
        { language },
      );
      setSettings(result.settings);
      if (result.syncReport.some((e) => e.status !== 'ok')) {
        setSyncReport(result.syncReport);
      }
    } finally {
      setLanguageLoading(false);
    }
  };

  const refreshRepos = async (): Promise<void> => {
    const list = await callIpc<LinkedRepoView[]>('repo.list', {});
    setRepos(list);
  };

  useEffect(() => {
    void (async () => {
      const current = await callIpc<SettingsModel | null>('settings.get', {});
      if (current !== null) setSettings(current);
      await refreshRepos();

      // Check PAT status
      try {
        const result = await callIpc<{ hasToken: boolean }>('credentials.hasGithubToken', {});
        setPatHasToken(result.hasToken);
      } catch (err) {
        if (err instanceof IpcCallError && err.kind === 'io') {
          setSafeStorageUnavailable(true);
        }
      }
    })();
  }, []);

  const handleAdapterToggle = async (
    key: AdapterKey,
    enabled: boolean,
  ): Promise<void> => {
    if (enabled) {
      const result = await callIpc<{ syncReport: SyncResult[] }>('adapter.setEnabled', {
        adapterId: key,
        enabled: true,
      });
      const current = await callIpc<SettingsModel | null>('settings.get', {});
      if (current !== null) setSettings(current);
      if (result.syncReport.some((e) => e.status !== 'ok')) {
        setSyncReport(result.syncReport);
      }
    } else {
      const { count } = await callIpc<{ count: number }>('adapter.countDestinations', {
        adapterId: key,
      });
      setDisableModal({ key, count });
    }
  };

  const handleDisableConfirm = async (removeSymlinks: boolean): Promise<void> => {
    if (!disableModal) return;
    const { key } = disableModal;
    setDisableModal(null);
    const result = await callIpc<{ removed: number; skipped: number; errors: unknown[] }>(
      'adapter.setEnabled',
      { adapterId: key, enabled: false, removeSymlinks },
    );
    const current = await callIpc<SettingsModel | null>('settings.get', {});
    if (current !== null) setSettings(current);
    if (removeSymlinks) {
      setDisableToast(`${result.removed} removidos, ${result.skipped} ignorados`);
      setTimeout(() => setDisableToast(null), 4000);
    }
  };

  const handleAddRepo = async (): Promise<void> => {
    setRepoError(null);
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
        setRepoError(`Não é um repositório git: ${path}`);
        return;
      }

      const branch = await callIpc<string | null>('repo.getCurrentBranch', { path });
      setPending({ path, branch });
    } catch (err) {
      setRepoError(err instanceof Error ? err.message : 'Erro de I/O');
    }
  };

  const handleConfirmLink = async (): Promise<void> => {
    if (pending === null) return;
    try {
      await callIpc<LinkedRepoView>('repo.link', { path: pending.path });
      setPending(null);
      await refreshRepos();
    } catch (err) {
      setRepoError(err instanceof Error ? err.message : 'Erro de I/O');
      setPending(null);
    }
  };

  const handleCancelLink = (): void => setPending(null);

  const handleUnlink = async (id: string): Promise<void> => {
    await callIpc('repo.unlink', { id });
    await refreshRepos();
  };

  const handleSavePat = async (): Promise<void> => {
    setPatLoading(true);
    setPatError(null);
    setPatSuccess(false);
    try {
      await callIpc('credentials.setGithubToken', { token: patValue });
      setPatHasToken(true);
      setPatValue('');
      setPatSuccess(true);
      setTimeout(() => setPatSuccess(false), 3000);
    } catch (err) {
      setPatError(err instanceof Error ? err.message : 'Falha ao salvar o PAT');
    } finally {
      setPatLoading(false);
    }
  };

  const handleClearPat = async (): Promise<void> => {
    setPatLoading(true);
    setPatError(null);
    try {
      await callIpc('credentials.clearGithubToken', {});
      setPatHasToken(false);
    } catch (err) {
      setPatError(err instanceof Error ? err.message : 'Falha ao limpar o PAT');
    } finally {
      setPatLoading(false);
    }
  };

  const handleRestore = async (): Promise<void> => {
    setRestoring(true);
    setRestoreError(null);
    try {
      await callIpc('app.restore', {});
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : 'Erro ao restaurar');
    } finally {
      setRestoring(false);
      setRestoreOpen(false);
    }
  };

  if (settings === null) {
    return (
      <Box
        component="main"
        data-testid="settings-loading"
        sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 1.5, color: 'text.secondary' }}
      >
        <CircularProgress size={18} />
        <Typography>Carregando…</Typography>
      </Box>
    );
  }

  return (
    <Container component="main" data-testid="settings-screen" maxWidth="md" sx={{ py: 4 }}>
      <ScreenHeader
        kicker="Configurações"
        title="Settings"
        actions={
          onBack ? (
            <Button variant="text" startIcon={<Icon glyph={ArrowLeft} size={16} />} onClick={onBack}>
              Voltar
            </Button>
          ) : undefined
        }
      />

      <Paper component="section" variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Kicker component="h2">Adapters</Kicker>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
          Habilite assistentes para manter suas customizações sincronizadas.
        </Typography>
        <FormGroup>
          {ADAPTER_KEYS.map((key) => (
            <FormControlLabel
              key={key}
              control={
                <Checkbox
                  id={`adapter-${key}`}
                  checked={settings.adapters[key].enabled}
                  onChange={(e) => void handleAdapterToggle(key, e.target.checked)}
                />
              }
              label={ADAPTER_LABEL[key]}
            />
          ))}
        </FormGroup>
        {settings.adapters.cursor.enabled && repos.length === 0 && (
          <Alert severity="info" sx={{ mt: 1.5 }} data-testid="cursor-no-repo-notice">
            Sem um repositório vinculado, suas skills e agents pessoais chegam ao Cursor, mas a
            instrução global e os itens com escopo de projeto não são sincronizados. Vincule um
            repositório abaixo para incluí-los.
          </Alert>
        )}
      </Paper>

      <Paper component="section" variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Kicker component="h2">Language</Kicker>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
          Controls the language prompt in your global instructions.
        </Typography>
        <FormControl size="small" sx={{ minWidth: 240 }}>
          <InputLabel id="language-select-label">Language</InputLabel>
          <Select
            labelId="language-select-label"
            label="Language"
            value={settings.language}
            disabled={languageLoading}
            onChange={(e) => void handleLanguageChange(e.target.value as LanguagePreference)}
          >
            {LANGUAGE_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {settings.language !== 'off' && (
          <Stack direction="row" sx={{ mt: 1.5, gap: 0.5, alignItems: 'center', color: 'text.secondary' }}>
            <Icon glyph={Info} size={16} />
            <Typography variant="caption">
              Code, comments, and test descriptions are always written in English.
            </Typography>
          </Stack>
        )}
      </Paper>

      <Paper component="section" variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Stack
          direction="row"
          sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}
        >
          <Kicker component="h2">Linked repos</Kicker>
          <Button variant="contained" startIcon={<Icon glyph={Plus} size={16} />} onClick={() => void handleAddRepo()}>
            Adicionar repo
          </Button>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Repositórios onde as customizações com escopo de projeto serão sincronizadas.
        </Typography>
        {repoError !== null ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {repoError}
          </Alert>
        ) : null}
        {repos.length === 0 ? (
          <Box
            sx={{
              border: 1,
              borderStyle: 'dashed',
              borderColor: 'divider',
              borderRadius: 1,
              p: 3,
              textAlign: 'center',
              color: 'text.secondary',
            }}
          >
            <Typography variant="body2">Nenhum repositório vinculado ainda.</Typography>
          </Box>
        ) : (
          <List dense disablePadding>
            {repos.map((repo) => (
              <ListItem
                key={repo.id}
                data-testid="linked-repo-item"
                divider
                secondaryAction={
                  <Tooltip title="Desvincular">
                    <IconButton
                      edge="end"
                      onClick={() => void handleUnlink(repo.id)}
                      aria-label="Desvincular"
                    >
                      <Icon glyph={Unlink} size={16} />
                    </IconButton>
                  </Tooltip>
                }
              >
                <ListItemText
                  primary={<Box component="strong">{repo.name}</Box>}
                  secondary={
                    <>
                      <Box
                        component="code"
                        sx={{ fontFamily: 'monospace', color: 'text.secondary' }}
                      >
                        {repo.path}
                      </Box>
                      {repo.branch !== null ? ` (${repo.branch})` : ' (sem branch)'}
                    </>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </Paper>

      <Paper component="section" variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Kicker component="h2">GitHub</Kicker>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
          Personal Access Token para publicar plugins no GitHub. Status:{' '}
          <strong>{patHasToken ? 'Configurado' : 'Não configurado'}</strong>
        </Typography>

        {safeStorageUnavailable && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Armazenamento seguro não está disponível neste sistema. O GitHub PAT não pode ser salvo.
          </Alert>
        )}

        {patError !== null && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {patError}
          </Alert>
        )}

        {patSuccess && (
          <Alert severity="success" sx={{ mb: 2 }}>
            PAT salvo com sucesso.
          </Alert>
        )}

        <Stack direction="row" sx={{ gap: 2, alignItems: 'flex-start' }}>
          <TextField
            type="password"
            label="GitHub Personal Access Token"
            value={patValue}
            onChange={(e) => setPatValue(e.target.value)}
            size="small"
            disabled={safeStorageUnavailable || patLoading}
            sx={{ flexGrow: 1 }}
          />
          <Button
            variant="contained"
            onClick={() => void handleSavePat()}
            disabled={!patValue || safeStorageUnavailable || patLoading}
          >
            Salvar
          </Button>
          <Button
            variant="outlined"
            color="error"
            onClick={() => void handleClearPat()}
            disabled={!patHasToken || safeStorageUnavailable || patLoading}
          >
            Limpar
          </Button>
        </Stack>
      </Paper>

      <Dialog
        open={pending !== null}
        onClose={handleCancelLink}
        aria-labelledby="link-confirm-title"
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle id="link-confirm-title">Confirmar vínculo de repo</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Vincular{' '}
            <Box component="code" sx={{ fontFamily: 'monospace' }}>
              {pending?.path}
            </Box>{' '}
            permite que o app crie <strong>symlinks</strong> em{' '}
            <Box component="code" sx={{ fontFamily: 'monospace' }}>
              .claude/
            </Box>{' '}
            dentro do repositório. Essas mudanças podem ser <strong>committed</strong> a menos que você as ignore via{' '}
            <Box component="code" sx={{ fontFamily: 'monospace' }}>
              .gitignore
            </Box>
            .
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelLink}>Cancelar</Button>
          <Button variant="contained" onClick={() => void handleConfirmLink()}>
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>

      {disableModal !== null && (
        <ConfirmDisableModal
          adapterName={ADAPTER_LABEL[disableModal.key]}
          count={disableModal.count}
          onConfirmRemove={() => void handleDisableConfirm(true)}
          onConfirmNoRemove={() => void handleDisableConfirm(false)}
          onCancel={() => setDisableModal(null)}
        />
      )}
      {disableToast !== null && (
        <Alert data-testid="disable-toast" role="status" severity="success" sx={{ mt: 2 }}>
          {disableToast}
        </Alert>
      )}
      {window.api.isDev && (
        <Paper
          component="section"
          variant="outlined"
          sx={{ p: 3, mb: 3, borderColor: 'error.main' }}
        >
          <Box sx={{ mb: 0.5 }}>
            <Kicker component="h2">Zona de perigo</Kicker>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Restaura o aplicativo para o estado inicial deletando <code>~/.superset-ai-app</code>,{' '}
            <code>~/.claude</code> e <code>.env.local</code>. O aplicativo será fechado em seguida.
          </Typography>
          {restoreError !== null && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {restoreError}
            </Alert>
          )}
          <Button
            variant="outlined"
            color="error"
            disabled={restoring}
            onClick={() => setRestoreOpen(true)}
          >
            {restoring ? 'Restaurando…' : 'Restaurar para estado inicial'}
          </Button>
        </Paper>
      )}

      <RestoreConfirmDialog
        open={restoreOpen}
        onConfirm={() => void handleRestore()}
        onCancel={() => setRestoreOpen(false)}
      />
      <SyncReportModal report={syncReport} onClose={() => setSyncReport([])} />
    </Container>
  );
}
