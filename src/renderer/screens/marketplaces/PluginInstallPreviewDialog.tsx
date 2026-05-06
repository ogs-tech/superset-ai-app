import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import TerminalIcon from '@mui/icons-material/Terminal';
import HubIcon from '@mui/icons-material/Hub';
import LanguageIcon from '@mui/icons-material/Language';
import PowerIcon from '@mui/icons-material/Power';
import { callIpc, IpcCallError } from '../../lib/ipc.js';

interface MarketplacePlugin {
  name: string;
  description: string;
  author?: { name: string };
  category?: string;
  source: unknown;
}

interface PluginManifest {
  id: string;
  version: string;
  description?: string;
  artifacts: {
    skills: string[];
    agents: string[];
    commands: string[];
    hooks: boolean;
    mcp: boolean;
    lsp: boolean;
  };
}

interface PluginInstallPreviewDialogProps {
  open: boolean;
  plugin: MarketplacePlugin | null;
  onCancel: () => void;
  onConfirm: () => void;
  installing: boolean;
}

export function PluginInstallPreviewDialog({
  open,
  plugin,
  onCancel,
  onConfirm,
  installing,
}: PluginInstallPreviewDialogProps): React.ReactElement {
  const [manifest, setManifest] = useState<PluginManifest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !plugin) {
      setManifest(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setManifest(null);

    void (async () => {
      try {
        const result = await callIpc<PluginManifest>('plugin.previewFromMarketplace', {
          plugin,
        });
        if (cancelled) return;
        setManifest(result);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof IpcCallError ? err.message : String(err);
        setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, plugin]);

  const ready = !loading && !error && manifest !== null;

  return (
    <Dialog
      open={open}
      onClose={installing ? undefined : onCancel}
      maxWidth="sm"
      fullWidth
      data-testid="plugin-install-preview-dialog"
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Typography component="span" variant="h6" sx={{ fontWeight: 600 }}>
            Install {plugin?.name ?? 'plugin'}?
          </Typography>
          {manifest?.version && (
            <Chip label={`v${manifest.version}`} size="small" variant="outlined" />
          )}
        </Stack>
        {plugin?.author?.name && (
          <Typography variant="caption" color="text.secondary">
            by {plugin.author.name}
            {plugin.category ? ` · ${plugin.category}` : ''}
          </Typography>
        )}
      </DialogTitle>

      <DialogContent dividers>
        {loading && (
          <Stack spacing={1.5} sx={{ alignItems: 'center', py: 4 }}>
            <CircularProgress size={28} />
            <Typography variant="body2" color="text.secondary">
              Inspecting plugin manifest…
            </Typography>
          </Stack>
        )}

        {error && (
          <Alert severity="error" data-testid="plugin-preview-error">
            {error}
          </Alert>
        )}

        {ready && manifest && (
          <Stack spacing={2}>
            {(plugin?.description ?? manifest.description) && (
              <Typography variant="body2" color="text.secondary">
                {plugin?.description ?? manifest.description}
              </Typography>
            )}

            <Box>
              <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                This plugin will add
              </Typography>

              <ArtifactGroup
                icon={<AutoAwesomeIcon fontSize="small" />}
                label="Skills"
                color="#6f42c1"
                items={manifest.artifacts.skills}
              />
              <ArtifactGroup
                icon={<SmartToyIcon fontSize="small" />}
                label="Agents"
                color="#0ea5e9"
                items={manifest.artifacts.agents}
              />
              <ArtifactGroup
                icon={<TerminalIcon fontSize="small" />}
                label="Commands"
                color="#f59e0b"
                items={manifest.artifacts.commands}
              />
            </Box>

            <Divider flexItem />

            <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
              <CapabilityFlag
                icon={<PowerIcon fontSize="small" />}
                label="Hooks"
                enabled={manifest.artifacts.hooks}
              />
              <CapabilityFlag
                icon={<HubIcon fontSize="small" />}
                label="MCP"
                enabled={manifest.artifacts.mcp}
              />
              <CapabilityFlag
                icon={<LanguageIcon fontSize="small" />}
                label="LSP"
                enabled={manifest.artifacts.lsp}
              />
            </Stack>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onCancel} disabled={installing}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={onConfirm}
          disabled={!ready || installing}
          data-testid="plugin-install-confirm"
        >
          {installing ? 'Installing…' : 'Install'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

interface ArtifactGroupProps {
  icon: React.ReactElement;
  label: string;
  color: string;
  items: string[];
}

function ArtifactGroup({ icon, label, color, items }: ArtifactGroupProps): React.ReactElement {
  return (
    <Box sx={{ mb: 1.5 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Box sx={{ color, display: 'flex' }}>{icon}</Box>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {label}
        </Typography>
        <Chip label={items.length} size="small" sx={{ height: 18, fontSize: 10 }} />
      </Stack>
      {items.length === 0 ? (
        <Typography variant="caption" color="text.secondary" sx={{ pl: 4 }}>
          none
        </Typography>
      ) : (
        <Box component="ul" sx={{ pl: 4, m: 0, mt: 0.25 }}>
          {items.map((item) => (
            <Typography
              key={item}
              component="li"
              variant="caption"
              color="text.secondary"
              sx={{ fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace' }}
            >
              {item}
            </Typography>
          ))}
        </Box>
      )}
    </Box>
  );
}

interface CapabilityFlagProps {
  icon: React.ReactElement;
  label: string;
  enabled: boolean;
}

function CapabilityFlag({ icon, label, enabled }: CapabilityFlagProps): React.ReactElement {
  return (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
      <Box sx={{ color: enabled ? 'success.main' : 'text.disabled', display: 'flex' }}>{icon}</Box>
      <Typography variant="caption" sx={{ fontWeight: 500 }}>
        {label}:
      </Typography>
      <Typography
        variant="caption"
        color={enabled ? 'success.main' : 'text.secondary'}
        sx={{ fontWeight: 500 }}
      >
        {enabled ? 'yes' : 'no'}
      </Typography>
    </Stack>
  );
}
