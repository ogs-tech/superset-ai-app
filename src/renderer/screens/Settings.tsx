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
  FormControlLabel,
  FormGroup,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import AddIcon from '@mui/icons-material/Add';
import { callIpc } from '../lib/ipc.js';
import { SyncReportModal } from '../components/SyncReportModal.js';
import { ConfirmDisableModal } from './settings/ConfirmDisableModal.js';
import type { SyncResult } from '../../shared/customization.js';
import type { LinkedRepoView, Settings as SettingsModel } from '../../shared/settings.js';

const labelFor = (key: 'claude' | 'copilot'): string =>
  key === 'claude' ? 'Claude' : 'Copilot';

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
  const [disableModal, setDisableModal] = useState<{ key: 'claude' | 'copilot'; count: number } | null>(null);
  const [disableToast, setDisableToast] = useState<string | null>(null);
  const [repos, setRepos] = useState<LinkedRepoView[]>([]);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingLink | null>(null);

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

  const handleExclusiveSkillsToggle = async (value: boolean): Promise<void> => {
    if (value) {
      await callIpc('adapter.removeAll', { adapterId: 'copilot' });
      await callIpc('settings.merge', { adapters: { copilot: { exclusiveSkillsWithClaude: true } } });
    } else {
      await callIpc('settings.merge', { adapters: { copilot: { exclusiveSkillsWithClaude: false } } });
      await callIpc('adapter.syncAll', { adapterId: 'copilot' });
    }
    const current = await callIpc<SettingsModel | null>('settings.get', {});
    if (current !== null) setSettings(current);
  };

  const handleAdapterToggle = async (
    key: 'claude' | 'copilot',
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
      const { count } = await callIpc<{ count: number }>('adapter.countDestinations', { adapterId: key });
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
      setDisableToast(`${result.removed} removed, ${result.skipped} skipped`);
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
        setRepoError(`Not a git repository: ${path}`);
        return;
      }

      const branch = await callIpc<string | null>('repo.getCurrentBranch', { path });
      setPending({ path, branch });
    } catch (err) {
      setRepoError(err instanceof Error ? err.message : 'I/O error');
    }
  };

  const handleConfirmLink = async (): Promise<void> => {
    if (pending === null) return;
    try {
      await callIpc<LinkedRepoView>('repo.link', { path: pending.path });
      setPending(null);
      await refreshRepos();
    } catch (err) {
      setRepoError(err instanceof Error ? err.message : 'I/O error');
      setPending(null);
    }
  };

  const handleCancelLink = (): void => setPending(null);

  const handleUnlink = async (id: string): Promise<void> => {
    await callIpc('repo.unlink', { id });
    await refreshRepos();
  };

  if (settings === null) {
    return (
      <Box
        component="main"
        data-testid="settings-loading"
        sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 1.5, color: 'text.secondary' }}
      >
        <CircularProgress size={18} />
        <Typography>Loading…</Typography>
      </Box>
    );
  }

  return (
    <Container component="main" data-testid="settings-screen" maxWidth="md" sx={{ py: 4 }}>
      <Stack
        direction="row"
        sx={{ mb: 4, justifyContent: 'space-between', alignItems: 'center' }}
      >
        <Typography variant="h4" component="h1">
          Settings
        </Typography>
        {onBack && (
          <Button
            variant="text"
            startIcon={<ArrowBackIcon />}
            onClick={onBack}
          >
            Back
          </Button>
        )}
      </Stack>

      <Paper
        component="section"
        variant="outlined"
        sx={{ p: 3, mb: 3 }}
      >
        <Typography variant="h6" component="h2" gutterBottom>
          Adapters
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Enable assistants to keep your customizations in sync.
        </Typography>
        <FormGroup>
          {(['claude', 'copilot'] as const).map((key) => (
            <FormControlLabel
              key={key}
              control={
                <Checkbox
                  id={`adapter-${key}`}
                  checked={settings.adapters[key].enabled}
                  onChange={(e) => void handleAdapterToggle(key, e.target.checked)}
                />
              }
              label={labelFor(key)}
            />
          ))}
          {settings.adapters.copilot.enabled && (
            <Tooltip title="Avoids duplicates in VS Code Copilot when Claude is also enabled">
              <FormControlLabel
                control={
                  <Checkbox
                    id="copilot-exclusive-skills"
                    checked={settings.adapters.copilot.exclusiveSkillsWithClaude}
                    onChange={(e) => void handleExclusiveSkillsToggle(e.target.checked)}
                  />
                }
                label="Skip Copilot skills when Claude is enabled (avoids duplicates in VS Code Copilot)"
              />
            </Tooltip>
          )}
        </FormGroup>
      </Paper>

      <Paper
        component="section"
        variant="outlined"
        sx={{ p: 3, mb: 3 }}
      >
        <Stack
          direction="row"
          sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}
        >
          <Typography variant="h6" component="h2">
            Linked repos
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => void handleAddRepo()}
          >
            Add repo
          </Button>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Repositories where project-scoped customizations will be synced.
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
            <Typography variant="body2">No repositories linked yet.</Typography>
          </Box>
        ) : (
          <List dense disablePadding>
            {repos.map((repo) => (
              <ListItem
                key={repo.id}
                data-testid="linked-repo-item"
                divider
                secondaryAction={
                  <Tooltip title="Unlink">
                    <IconButton
                      edge="end"
                      onClick={() => void handleUnlink(repo.id)}
                      aria-label="Unlink"
                    >
                      <LinkOffIcon fontSize="small" />
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
                      {repo.branch !== null ? ` (${repo.branch})` : ' (no branch)'}
                    </>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </Paper>

      <Dialog
        open={pending !== null}
        onClose={handleCancelLink}
        aria-labelledby="link-confirm-title"
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle id="link-confirm-title">Confirm repo link</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Linking{' '}
            <Box component="code" sx={{ fontFamily: 'monospace' }}>
              {pending?.path}
            </Box>{' '}
            allows the app to create <strong>symlinks</strong> in{' '}
            <Box component="code" sx={{ fontFamily: 'monospace' }}>
              .claude/
            </Box>{' '}
            and{' '}
            <Box component="code" sx={{ fontFamily: 'monospace' }}>
              .github/
            </Box>{' '}
            inside the repository. These changes may be{' '}
            <strong>committed</strong> unless you ignore them via{' '}
            <Box component="code" sx={{ fontFamily: 'monospace' }}>
              .gitignore
            </Box>
            .
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelLink}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleConfirmLink()}>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      {disableModal !== null && (
        <ConfirmDisableModal
          adapterName={labelFor(disableModal.key)}
          count={disableModal.count}
          onConfirmRemove={() => void handleDisableConfirm(true)}
          onConfirmNoRemove={() => void handleDisableConfirm(false)}
          onCancel={() => setDisableModal(null)}
        />
      )}
      {disableToast !== null && (
        <Alert
          data-testid="disable-toast"
          role="status"
          severity="success"
          sx={{ mt: 2 }}
        >
          {disableToast}
        </Alert>
      )}
      <SyncReportModal report={syncReport} onClose={() => setSyncReport([])} />
    </Container>
  );
}
