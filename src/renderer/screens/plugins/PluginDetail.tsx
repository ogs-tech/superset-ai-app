import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { callIpc, IpcCallError } from '../../lib/ipc.js';
import type { PluginDetailIpc } from '../../../shared/plugin-ipc-types.js';

interface PluginDetailProps {
  pluginId: string;
  scope: 'personal' | 'project';
  onClose: () => void;
  onOpenEditor?: (pluginId: string) => void;
  onOpenPublish?: (pluginId: string) => void;
}

export function PluginDetail({
  pluginId,
  scope,
  onClose,
  onOpenEditor,
  onOpenPublish,
}: PluginDetailProps): React.ReactElement {
  const [detail, setDetail] = useState<PluginDetailIpc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDetail = async (): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const result = await callIpc<PluginDetailIpc>('plugin.get', { id: pluginId, scope });
        setDetail(result);
      } catch (err) {
        const message = err instanceof IpcCallError ? err.message : String(err);
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void loadDetail();
  }, [pluginId, scope]);

  const renderRefDisplay = (ref: any): string => {
    if (!ref) return '—';
    return `${ref.kind}: ${ref.value}`;
  };

  const renderArtifacts = (artifacts: any): React.ReactElement => {
    if (!artifacts) {
      return <Typography variant="body2" color="text.secondary">No artifacts</Typography>;
    }

    const items = [];
    if (artifacts.skills && artifacts.skills.length > 0) {
      items.push(`Skills: ${artifacts.skills.join(', ')}`);
    }
    if (artifacts.agents && artifacts.agents.length > 0) {
      items.push(`Agents: ${artifacts.agents.join(', ')}`);
    }
    if (artifacts.commands && artifacts.commands.length > 0) {
      items.push(`Commands: ${artifacts.commands.join(', ')}`);
    }
    if (artifacts.hooks > 0) {
      items.push(`Hooks: ${artifacts.hooks}`);
    }
    if (artifacts.mcp) {
      items.push('MCP');
    }
    if (artifacts.lsp) {
      items.push('LSP');
    }

    if (items.length === 0) {
      return <Typography variant="body2" color="text.secondary">No artifacts</Typography>;
    }

    return (
      <Stack spacing={1}>
        {items.map((item, idx) => (
          <Typography key={idx} variant="body2">
            {item}
          </Typography>
        ))}
      </Stack>
    );
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper' }}>
      {/* Header */}
      <Stack
        direction="row"
        sx={{ p: 2, borderBottom: 1, borderColor: 'divider', alignItems: 'center' }}
      >
        <IconButton onClick={onClose} aria-label="Close">
          <CloseIcon />
        </IconButton>
        <Typography variant="h6" sx={{ ml: 1 }}>
          Plugin: {pluginId}
        </Typography>
      </Stack>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && error && (
          <Alert severity="error">
            {error}
          </Alert>
        )}

        {!loading && detail && (
          <Stack spacing={3}>
            {/* Drift Alert */}
            {detail.drift && (
              <Alert severity="warning">
                {detail.drift.details ?? `Drift detected: ${detail.drift.kind}`}
              </Alert>
            )}

            {/* Basic Info */}
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                Basic Information
              </Typography>
              <Stack spacing={1}>
                <Box sx={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>ID:</Typography>
                  <Typography variant="body2">{detail.id}</Typography>

                  <Typography variant="body2" sx={{ fontWeight: 500 }}>Origin:</Typography>
                  <Box>
                    <Chip
                      label={detail.origin}
                      color={detail.origin === 'imported' ? 'info' : 'success'}
                      size="small"
                    />
                  </Box>

                  <Typography variant="body2" sx={{ fontWeight: 500 }}>Scope:</Typography>
                  <Typography variant="body2">{detail.scope}</Typography>

                  <Typography variant="body2" sx={{ fontWeight: 500 }}>Enabled:</Typography>
                  <Typography variant="body2">{detail.enabled ? 'Yes' : 'No'}</Typography>

                  <Typography variant="body2" sx={{ fontWeight: 500 }}>Installed at:</Typography>
                  <Typography variant="body2">{detail.installedAt}</Typography>
                </Box>
              </Stack>
            </Paper>

            {/* Manifest Info */}
            {detail.manifest && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                  Manifest
                </Typography>
                <Stack spacing={1}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>Version:</Typography>
                    <Typography variant="body2">{detail.manifest.version}</Typography>

                    {detail.manifest.description && (
                      <>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>Description:</Typography>
                        <Typography variant="body2">{detail.manifest.description}</Typography>
                      </>
                    )}
                  </Box>
                </Stack>
              </Paper>
            )}

            {/* Source Info (for imported) */}
            {detail.origin === 'imported' && detail.source && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                  Source
                </Typography>
                <Stack spacing={1}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>URL:</Typography>
                    <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                      {detail.source.url}
                    </Typography>

                    <Typography variant="body2" sx={{ fontWeight: 500 }}>Ref:</Typography>
                    <Typography variant="body2">{renderRefDisplay(detail.source.ref)}</Typography>

                    <Typography variant="body2" sx={{ fontWeight: 500 }}>Installed ref:</Typography>
                    <Typography variant="body2">{renderRefDisplay(detail.installedRef)}</Typography>
                  </Box>
                </Stack>
              </Paper>
            )}

            {/* Publish Info (for owned) */}
            {detail.origin === 'owned' && detail.publishInfo && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                  Publish Information
                </Typography>
                <Stack spacing={1}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>Remote URL:</Typography>
                    <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                      {detail.publishInfo.remoteUrl}
                    </Typography>

                    <Typography variant="body2" sx={{ fontWeight: 500 }}>Visibility:</Typography>
                    <Typography variant="body2">{detail.publishInfo.visibility}</Typography>

                    <Typography variant="body2" sx={{ fontWeight: 500 }}>Last published:</Typography>
                    <Typography variant="body2">{detail.publishInfo.lastPublishedAt}</Typography>

                    <Typography variant="body2" sx={{ fontWeight: 500 }}>Version:</Typography>
                    <Typography variant="body2">{detail.publishInfo.lastPublishedVersion}</Typography>
                  </Box>
                </Stack>
              </Paper>
            )}

            {/* Artifacts */}
            {detail.manifest && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                  Artifacts
                </Typography>
                {renderArtifacts(detail.manifest.artifacts)}
              </Paper>
            )}

            {/* Actions */}
            <Stack direction="row" spacing={1}>
              {detail.origin === 'owned' && (
                <>
                  <Button
                    variant="contained"
                    onClick={() => onOpenEditor?.(pluginId)}
                  >
                    Open editor
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => onOpenPublish?.(pluginId)}
                  >
                    Publish
                  </Button>
                </>
              )}
              {detail.drift && (
                <Button variant="outlined" disabled>
                  Reconcile (coming soon)
                </Button>
              )}
            </Stack>
          </Stack>
        )}
      </Box>
    </Box>
  );
}
