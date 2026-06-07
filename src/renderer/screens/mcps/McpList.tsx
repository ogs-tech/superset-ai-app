import { Box, CircularProgress, Container, Divider, Stack, Typography } from '@mui/material';
import { ScreenHeader } from '../../components/ds/ScreenHeader.js';
import { StatusPill } from '../../components/ds/StatusPill.js';
import { PluginOriginBadge } from '../../components/PluginOriginBadge.js';
import { useMcpList } from '../../hooks/use-mcp-list.js';
import type { McpHealthState, McpScope, McpServer } from '../../../shared/mcp.js';

const SCOPE_LABEL: Record<McpScope, string> = {
  global: 'Personal',
  'project-local': 'Project (local)',
  'project-shared': 'Project (shared)',
  plugin: 'Plugin',
};

const HEALTH_PILL: Record<McpHealthState, 'ok' | 'warning' | 'error'> = {
  ok: 'ok',
  warning: 'warning',
  error: 'error',
  'needs-auth': 'warning',
};

function HealthBadge({ server }: { server: McpServer }): React.ReactElement | null {
  if (!server.health) return null;
  return <StatusPill variant={HEALTH_PILL[server.health.state]} label={server.health.state} />;
}

export function McpList(): React.ReactElement {
  const { data, isLoading } = useMcpList();
  const servers = data ?? [];

  return (
    <Container component="main" data-testid="mcp-screen" maxWidth="lg" sx={{ py: 2.5 }}>
      <ScreenHeader
        kicker="Biblioteca"
        title="MCP"
        {...(data !== undefined ? { subtitle: `${servers.length} server(s)` } : {})}
      />

      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={24} />
        </Box>
      )}

      {!isLoading && (
        <Stack divider={<Divider />} sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
          {servers.map((server) => (
            <Box
              key={server.id}
              data-testid={`mcp-row-${server.id}`}
              sx={{ p: 1.5, display: 'flex', gap: 1.5, alignItems: 'center', justifyContent: 'space-between' }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2">{server.name}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {server.transport} · {SCOPE_LABEL[server.scope]}
                </Typography>
                {server.health?.detail !== undefined && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {server.health.detail}
                  </Typography>
                )}
              </Box>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <HealthBadge server={server} />
                {server.source.kind === 'plugin' && (
                  <PluginOriginBadge
                    pluginId={server.source.pluginId}
                    provenance={server.source.provenance}
                  />
                )}
              </Stack>
            </Box>
          ))}
        </Stack>
      )}
    </Container>
  );
}
