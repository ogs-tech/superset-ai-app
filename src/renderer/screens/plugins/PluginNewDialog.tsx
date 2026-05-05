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
import type { PluginCreateOwnedRequest } from '../../../shared/plugin-ipc-types.js';

interface PluginNewDialogProps {
  open: boolean;
  scope: 'personal' | 'project';
  onClose: () => void;
  onSuccess: (pluginId: string) => void;
}

export function PluginNewDialog({ open, scope, onClose, onSuccess }: PluginNewDialogProps): React.ReactElement {
  const [id, setId] = useState('');
  const [version, setVersion] = useState('0.1.0');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [idError, setIdError] = useState<string | null>(null);
  const [versionError, setVersionError] = useState<string | null>(null);

  const idRegex = /^[a-z][a-z0-9-]{0,63}$/;
  const versionRegex = /^\d+\.\d+\.\d+/;

  const validateId = (value: string): boolean => {
    if (!value) {
      setIdError('Plugin ID is required');
      return false;
    }
    if (!idRegex.test(value)) {
      setIdError('Must start with a letter, contain only lowercase letters, digits, and hyphens (max 64 characters)');
      return false;
    }
    setIdError(null);
    return true;
  };

  const validateVersion = (value: string): boolean => {
    if (!value) {
      setVersionError('Version is required');
      return false;
    }
    if (!versionRegex.test(value)) {
      setVersionError('Version must be in format X.Y.Z (e.g., 0.1.0)');
      return false;
    }
    setVersionError(null);
    return true;
  };

  const handleSubmit = async () => {
    // Clear previous global error
    setGlobalError(null);

    // Validate fields
    const idValid = validateId(id);
    const versionValid = validateVersion(version);

    if (!idValid || !versionValid) {
      return;
    }

    setLoading(true);

    try {
      const request: PluginCreateOwnedRequest = {
        id,
        version,
        ...(description && { description }),
        scope,
      };

      const result = await callIpc<{ id: string }>('plugin.createOwned', request);
      onSuccess(result.id);
      onClose();
    } catch (err) {
      if (err instanceof IpcCallError) {
        if (err.kind === 'validation' && err.message.includes('collision')) {
          setGlobalError('A plugin with this ID already exists');
        } else {
          setGlobalError(err.message);
        }
      } else {
        setGlobalError(String(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  const handleIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setId(e.target.value);
    if (idError) {
      validateId(e.target.value);
    }
  };

  const handleVersionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVersion(e.target.value);
    if (versionError) {
      validateVersion(e.target.value);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      aria-labelledby="plugin-new-dialog-title"
      data-testid="plugin-new-dialog"
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle id="plugin-new-dialog-title">New Plugin</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        {globalError && (
          <Alert severity="error" role="alert" sx={{ mb: 2 }}>
            {globalError}
          </Alert>
        )}
        <Stack spacing={2}>
          <TextField
            autoFocus
            label="Plugin ID"
            required
            fullWidth
            value={id}
            onChange={handleIdChange}
            error={!!idError}
            helperText={idError}
            disabled={loading}
            placeholder="my-plugin"
            slotProps={{
              htmlInput: {
                'aria-label': 'Plugin ID',
                'data-testid': 'plugin-id-field',
              },
            }}
          />
          <TextField
            label="Version"
            required
            fullWidth
            value={version}
            onChange={handleVersionChange}
            error={!!versionError}
            helperText={versionError}
            disabled={loading}
            placeholder="0.1.0"
            slotProps={{
              htmlInput: {
                'aria-label': 'Version',
                'data-testid': 'plugin-version-field',
              },
            }}
          />
          <TextField
            label="Description (optional)"
            fullWidth
            multiline
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={loading}
            slotProps={{
              htmlInput: {
                'aria-label': 'Description',
                'data-testid': 'plugin-description-field',
              },
            }}
          />
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
          data-testid="plugin-create-btn"
        >
          {loading ? 'Creating...' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
