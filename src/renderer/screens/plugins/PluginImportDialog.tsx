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
      setError('A URL do repositório é obrigatória');
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
          `Esta URL aponta para um marketplace${
            detected.manifest.name ? ` ("${detected.manifest.name}")` : ''
          }. Importe-o pela tela de Marketplaces.`,
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
      <DialogTitle id="plugin-import-title">Importar Plugin</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && (
            <Alert severity="error" role="alert">
              {error}
            </Alert>
          )}

          {marketplaceWarning && (
            <Alert
              severity="warning"
              role="alert"
              data-testid="plugin-import-marketplace-warning"
            >
              {marketplaceWarning}
            </Alert>
          )}

          <TextField
            label="URL do repositório ou owner/repo"
            placeholder="ex.: https://github.com/user/plugin ou user/plugin"
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
            label="Branch/Tag/SHA (opcional)"
            placeholder="ex.: main, v1.0.0, abc123… (deixe vazio para o padrão)"
            fullWidth
            value={refInput}
            onChange={(e) => setRefInput(e.target.value)}
            disabled={loading}
            data-testid="plugin-ref-input"
          />

          <Typography variant="caption" color="text.secondary">
            Informe uma URL de repositório GitHub (https://github.com/user/repo) ou a forma abreviada (user/repo).
            Opcionalmente, especifique um branch, tag ou SHA de commit para importar uma versão específica.
          </Typography>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading}
          data-testid="plugin-import-btn"
        >
          {loading ? 'Importando…' : 'Importar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
