import {
  Box,
  Chip,
  Paper,
  Stack,
  Alert,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { callIpc, IpcCallError } from '../../lib/ipc.js';
import type {
  PluginArtifacts,
  PluginDetailIpc,
  PluginRefIpc,
} from '../../../shared/plugin-ipc-types.js';
import { PluginRelatedEntities } from '../../components/PluginRelatedEntities.js';
import { Kicker, LoadingState, ErrorState } from '../../components/ds/index.js';

interface PluginDetailProps {
  pluginId: string;
  scope: 'personal' | 'project';
}

function refDisplay(ref: PluginRefIpc | undefined): string {
  if (!ref) return '—';
  return `${ref.kind}: ${ref.value}`;
}

function ArtifactList({
  artifacts,
}: {
  artifacts: PluginArtifacts;
}): React.ReactElement {
  const items: string[] = [];
  if (artifacts.skills.length > 0) {
    items.push(`Skills: ${artifacts.skills.join(', ')}`);
  }
  if (artifacts.agents.length > 0) {
    items.push(`Agents: ${artifacts.agents.join(', ')}`);
  }
  if (artifacts.commands.length > 0) {
    items.push(`Commands: ${artifacts.commands.join(', ')}`);
  }
  if (artifacts.hooks > 0) {
    items.push(`Hooks: ${artifacts.hooks}`);
  }
  if (artifacts.mcp) items.push('MCP');
  if (artifacts.lsp) items.push('LSP');

  if (items.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Nenhum artefato
      </Typography>
    );
  }

  return (
    <Stack spacing={1}>
      {items.map((item) => (
        <Typography key={item} variant="body2">
          {item}
        </Typography>
      ))}
    </Stack>
  );
}

export function PluginDetail({
  pluginId,
  scope,
}: PluginDetailProps): React.ReactElement {
  const { data: detail, isLoading, error } = useQuery<PluginDetailIpc>({
    queryKey: ['plugin.detail', scope, pluginId],
    queryFn: () =>
      callIpc<PluginDetailIpc>('plugin.get', { id: pluginId, scope }),
  });

  if (isLoading) {
    return <LoadingState kind="detail" testId="plugin-detail" />;
  }

  if (error) {
    const message = error instanceof IpcCallError ? error.message : String(error);
    return <ErrorState message={message} testId="plugin-detail" />;
  }

  if (!detail) return <Box data-testid="plugin-detail" />;

  return (
    <Stack spacing={3} data-testid="plugin-detail">
      {detail.drift && (
        <Alert severity="warning">
          {detail.drift.details ?? `Desvio detectado: ${detail.drift.kind}`}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Box sx={{ mb: 1 }}><Kicker>Informações básicas</Kicker></Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>ID:</Typography>
          <Typography variant="body2">{detail.id}</Typography>

          <Typography variant="body2" sx={{ fontWeight: 500 }}>Origem:</Typography>
          <Box>
            <Chip
              label={detail.origin}
              color={detail.origin === 'imported' ? 'info' : 'success'}
              size="small"
            />
          </Box>

          <Typography variant="body2" sx={{ fontWeight: 500 }}>Escopo:</Typography>
          <Typography variant="body2">{detail.scope}</Typography>

          <Typography variant="body2" sx={{ fontWeight: 500 }}>Habilitado:</Typography>
          <Typography variant="body2">{detail.enabled ? 'Sim' : 'Não'}</Typography>

          <Typography variant="body2" sx={{ fontWeight: 500 }}>Instalado em:</Typography>
          <Typography variant="body2">{detail.installedAt}</Typography>
        </Box>
      </Paper>

      {detail.manifest && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Box sx={{ mb: 1 }}><Kicker>Manifest</Kicker></Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>Versão:</Typography>
            <Typography variant="body2">{detail.manifest.version}</Typography>

            {detail.manifest.description && (
              <>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>Descrição:</Typography>
                <Typography variant="body2">{detail.manifest.description}</Typography>
              </>
            )}
          </Box>
        </Paper>
      )}

      {detail.origin === 'imported' && detail.source && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Box sx={{ mb: 1 }}><Kicker>Fonte</Kicker></Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>URL:</Typography>
            <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
              {detail.source.url}
            </Typography>

            <Typography variant="body2" sx={{ fontWeight: 500 }}>Ref:</Typography>
            <Typography variant="body2">{refDisplay(detail.source.ref)}</Typography>

            <Typography variant="body2" sx={{ fontWeight: 500 }}>Ref instalada:</Typography>
            <Typography variant="body2">{refDisplay(detail.installedRef)}</Typography>
          </Box>
        </Paper>
      )}

      {detail.origin === 'owned' && detail.publishInfo && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Box sx={{ mb: 1 }}><Kicker>Informações de publicação</Kicker></Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>URL remota:</Typography>
            <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
              {detail.publishInfo.remoteUrl}
            </Typography>

            <Typography variant="body2" sx={{ fontWeight: 500 }}>Visibilidade:</Typography>
            <Typography variant="body2">{detail.publishInfo.visibility}</Typography>

            <Typography variant="body2" sx={{ fontWeight: 500 }}>Última publicação:</Typography>
            <Typography variant="body2">{detail.publishInfo.lastPublishedAt}</Typography>

            <Typography variant="body2" sx={{ fontWeight: 500 }}>Versão:</Typography>
            <Typography variant="body2">{detail.publishInfo.lastPublishedVersion}</Typography>
          </Box>
        </Paper>
      )}

      {detail.manifest && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Box sx={{ mb: 1 }}><Kicker>Artefatos</Kicker></Box>
          <ArtifactList artifacts={detail.manifest.artifacts} />
        </Paper>
      )}

      <PluginRelatedEntities pluginId={pluginId} scope={scope} />
    </Stack>
  );
}
