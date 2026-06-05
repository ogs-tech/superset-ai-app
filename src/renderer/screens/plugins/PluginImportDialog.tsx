import { useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { callIpc, IpcCallError } from '../../lib/ipc.js';
import type {
  MarketplaceDetectResult,
  PluginImportRequest,
} from '../../../shared/plugin-ipc-types.js';

interface PluginImportDialogProps {
  open: boolean;
  scope: 'personal' | 'project';
  onClose: () => void;
  onSuccess: (pluginId: string) => void;
}

export function PluginImportDialog({
  open,
  scope,
  onClose,
  onSuccess,
}: PluginImportDialogProps): React.ReactElement {
  const [urlInput, setUrlInput] = useState('');
  const [refInput, setRefInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [marketplaceWarning, setMarketplaceWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleClose = () => {
    setUrlInput('');
    setRefInput('');
    setError(null);
    setMarketplaceWarning(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!urlInput.trim()) {
      setError('Repository URL is required');
      return;
    }

    setError(null);
    setMarketplaceWarning(null);
    setLoading(true);

    try {
      const detected = await callIpc<MarketplaceDetectResult>('marketplace.detect', {
        url: urlInput.trim(),
      });

      if (detected.kind === 'marketplace') {
        setMarketplaceWarning(
          `This URL points to a marketplace${
            detected.manifest.name ? ` ("${detected.manifest.name}")` : ''
          }. Import it from the Marketplaces screen.`,
        );
        return;
      }

      const request: PluginImportRequest = refInput.trim()
        ? { url: urlInput.trim(), ref: { kind: 'branch', value: refInput.trim() }, scope }
        : { url: urlInput.trim(), scope };

      const result = await callIpc<{ id: string }>('plugin.import', request);
      onSuccess(result.id);
      handleClose();
    } catch (err) {
      const message = err instanceof IpcCallError ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      aria-labelledby="plugin-import-title"
      data-testid="plugin-import-dialog"
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle id="plugin-import-title">Import Plugin</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && (
            <Alert severity="error" role="alert">
              {error}
            </Alert>
          )}

          {marketplaceWarning && (
            <Alert severity="warning" role="alert" data-testid="plugin-import-marketplace-warning">
              {marketplaceWarning}
            </Alert>
          )}

          <TextField
            label="Repository URL or owner/repo"
            placeholder="e.g., https://github.com/user/plugin or user/plugin"
            fullWidth
            required
            value={urlInput}
            onChange={(e) => {
              setUrlInput(e.target.value);
              if (marketplaceWarning) setMarketplaceWarning(null);
            }}
            disabled={loading}
            data-testid="plugin-url-input"
          />

          <TextField
            label="Branch/Tag/SHA (optional)"
            placeholder="e.g., main, v1.0.0, abc123... (leave empty for default)"
            fullWidth
            value={refInput}
            onChange={(e) => setRefInput(e.target.value)}
            disabled={loading}
            data-testid="plugin-ref-input"
          />

          <Typography variant="caption" color="text.secondary">
            Enter a GitHub repository URL (https://github.com/user/repo) or shorthand (user/repo).
            Optionally specify a branch, tag, or commit SHA to import from a specific version.
          </Typography>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading}
          data-testid="plugin-import-btn"
        >
          {loading ? 'Importing...' : 'Import'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
