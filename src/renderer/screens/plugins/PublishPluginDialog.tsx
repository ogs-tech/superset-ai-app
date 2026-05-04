import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { callIpc, IpcCallError } from '../../lib/ipc.js';
import type { PluginPublishRequest } from '../../../shared/plugin-ipc-types.js';

interface PublishPluginDialogProps {
  open: boolean;
  pluginId: string;
  currentVersion?: string | undefined;
  hasPublishInfo: boolean;
  scope: 'personal' | 'project';
  onClose: () => void;
  onSuccess: () => void;
}

export function PublishPluginDialog({
  open,
  pluginId,
  currentVersion,
  hasPublishInfo,
  scope,
  onClose,
  onSuccess,
}: PublishPluginDialogProps): React.ReactElement {
  // First publish form fields
  const [repoName, setRepoName] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');

  // Shared form fields
  const [version, setVersion] = useState('');
  const [commitMessage, setCommitMessage] = useState('');

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [githubTokenMissing, setGithubTokenMissing] = useState(false);

  // Pre-check GitHub token on open
  useEffect(() => {
    if (!open) return;

    const checkGithubToken = async () => {
      try {
        const result = await callIpc<{ hasToken: boolean }>('credentials.hasGithubToken', {});
        setGithubTokenMissing(!result.hasToken);
      } catch (err) {
        // If check fails, assume token is missing for safety
        setGithubTokenMissing(true);
      }
    };

    checkGithubToken();
  }, [open]);

  // Initialize form values based on first vs. republish
  useEffect(() => {
    if (!open) return;

    if (!hasPublishInfo) {
      // First publish
      setRepoName(pluginId);
      setVisibility('public');
      setVersion(currentVersion || '0.1.0');
      setCommitMessage(`chore: publish v${currentVersion || '0.1.0'}`);
    } else {
      // Republish
      setVersion('');
      setCommitMessage('');
    }

    setError(null);
  }, [open, hasPublishInfo, pluginId, currentVersion]);

  // Update commit message when version changes
  useEffect(() => {
    if (version && !hasPublishInfo) {
      setCommitMessage(`chore: publish v${version}`);
    }
  }, [version, hasPublishInfo]);

  const handleClose = () => {
    setRepoName('');
    setVisibility('public');
    setVersion('');
    setCommitMessage('');
    setError(null);
    setGithubTokenMissing(false);
    onClose();
  };

  const validateForm = (): boolean => {
    if (!hasPublishInfo) {
      // First publish validation
      if (!repoName.trim()) {
        setError('Repository name is required');
        return false;
      }
      if (!version.trim()) {
        setError('Version is required');
        return false;
      }
    } else {
      // Republish validation
      if (!version.trim()) {
        setError('Version is required');
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const request: PluginPublishRequest = {
        id: pluginId,
        scope,
        version: version.trim(),
        ...(commitMessage.trim() ? { commitMessage: commitMessage.trim() } : {}),
        ...((!hasPublishInfo) ? {
          repoName: repoName.trim(),
          visibility,
        } : {}),
      };

      await callIpc<void>('plugin.publish', request);

      // On success
      onSuccess();
      handleClose();
    } catch (err) {
      if (err instanceof IpcCallError) {
        if (err.kind === 'auth') {
          setError('Configure your GitHub PAT in Settings');
        } else if (err.kind === 'conflict') {
          const msg = err.message;
          if (msg.includes('already exists')) {
            setError('Repository already exists. Use a different name.');
          } else if (msg.includes('diverged')) {
            setError('Remote has diverged. Resolve manually.');
          } else if (msg.includes('tag')) {
            setError('Version tag already exists. Bump the version.');
          } else {
            setError(msg);
          }
        } else {
          setError(err.message);
        }
      } else {
        setError(String(err));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      aria-labelledby="publish-plugin-title"
      data-testid="publish-plugin-dialog"
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle id="publish-plugin-title">
        {hasPublishInfo ? 'Republish Plugin' : 'Publish Plugin'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {githubTokenMissing && (
            <Alert severity="warning" role="alert">
              GitHub PAT not configured. Please configure it in Settings.
            </Alert>
          )}

          {error && (
            <Alert severity="error" role="alert">
              {error}
            </Alert>
          )}

          {!hasPublishInfo && (
            <>
              <TextField
                label="Repository name"
                placeholder="e.g., my-plugin"
                fullWidth
                required
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
                disabled={loading || githubTokenMissing}
                data-testid="publish-repo-name-input"
              />

              <FormControl component="fieldset" disabled={loading || githubTokenMissing}>
                <Typography variant="subtitle2" component="label" sx={{ mb: 1 }}>
                  Visibility
                </Typography>
                <RadioGroup
                  row
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as 'public' | 'private')}
                  data-testid="publish-visibility-group"
                >
                  <FormControlLabel value="public" control={<Radio />} label="Public" />
                  <FormControlLabel value="private" control={<Radio />} label="Private" />
                </RadioGroup>
              </FormControl>
            </>
          )}

          <TextField
            label="Version"
            placeholder={hasPublishInfo ? 'e.g., 1.0.1' : '0.1.0'}
            fullWidth
            required
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            disabled={loading || githubTokenMissing}
            data-testid="publish-version-input"
            helperText={
              hasPublishInfo ? 'Must be higher than the current version' : undefined
            }
          />

          <TextField
            label="Commit message"
            placeholder="e.g., chore: publish v1.0.0"
            fullWidth
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            disabled={loading || githubTokenMissing}
            data-testid="publish-commit-message-input"
            helperText="Leave empty for auto-generated message"
          />

          {githubTokenMissing && (
            <Typography variant="caption" color="warning.main">
              Please configure your GitHub Personal Access Token in Settings to publish plugins.
            </Typography>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || githubTokenMissing}
          data-testid="publish-plugin-btn"
        >
          {loading ? 'Publishing...' : 'Publish'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
