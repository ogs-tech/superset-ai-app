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

interface MarketplaceImportDialogProps {
  open: boolean;
  onClose: () => void;
  onMarketplaceAdded: (id: string) => void;
}

export function MarketplaceImportDialog({
  open,
  onClose,
  onMarketplaceAdded,
}: MarketplaceImportDialogProps): React.ReactElement {
  const [urlInput, setUrlInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleClose = () => {
    setUrlInput('');
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!urlInput.trim()) {
      setError('Repository URL is required');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const result = await callIpc<{ id: string }>('marketplace.addFromUrl', {
        scope: 'personal',
        url: urlInput.trim(),
      });
      onMarketplaceAdded(result.id);
      setUrlInput('');
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
      onClose={loading ? undefined : handleClose}
      aria-labelledby="marketplace-import-title"
      data-testid="marketplace-import-dialog"
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle id="marketplace-import-title">Import Marketplace</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && (
            <Alert
              severity="error"
              role="alert"
              data-testid="marketplace-import-error"
            >
              {error}
            </Alert>
          )}

          <TextField
            label="Repository URL or owner/repo"
            placeholder="e.g., https://github.com/user/marketplace or user/marketplace"
            fullWidth
            required
            value={urlInput}
            onChange={(e) => {
              setUrlInput(e.target.value);
              if (error) setError(null);
            }}
            disabled={loading}
            data-testid="marketplace-url-input"
          />

          <Typography variant="caption" color="text.secondary">
            Enter a GitHub repository URL containing a <code>marketplace.json</code> manifest. The
            marketplace will be added to your list and you can install plugins from it.
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
          data-testid="marketplace-import-btn"
        >
          {loading ? 'Importing...' : 'Import'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
