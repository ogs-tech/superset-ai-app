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
} from '@mui/material';
import { callIpc, IpcCallError } from '../../lib/ipc.js';

interface AddMarketplaceDialogProps {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}

const ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;

export function AddMarketplaceDialog({
  open,
  onClose,
  onAdded,
}: AddMarketplaceDialogProps): React.ReactElement {
  const [id, setId] = useState('');
  const [path, setPath] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = ID_PATTERN.test(id) && path.trim().length > 0;

  const handleSubmit = async (): Promise<void> => {
    if (!valid) return;
    setSubmitting(true);
    setError(null);
    try {
      await callIpc('marketplace.add', {
        scope: 'personal',
        id,
        source: { path: path.trim() },
      });
      setId('');
      setPath('');
      onAdded();
      onClose();
    } catch (err) {
      const message = err instanceof IpcCallError ? err.message : String(err);
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      data-testid="add-marketplace-dialog"
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>Add marketplace</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Marketplace ID"
            placeholder="claude-plugins-official"
            value={id}
            onChange={(e) => setId(e.target.value)}
            helperText="Lowercase, starts with letter, kebab-case (max 64 chars)"
            error={id.length > 0 && !ID_PATTERN.test(id)}
            data-testid="marketplace-id-input"
            fullWidth
          />
          <TextField
            label="Directory path"
            placeholder="/path/to/marketplace"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            helperText="Local directory containing marketplace.json"
            data-testid="marketplace-path-input"
            fullWidth
          />
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!valid || submitting}
          data-testid="marketplace-add-submit"
        >
          {submitting ? 'Adding…' : 'Add'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
