import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useHealthReport } from '../../hooks/use-health-report.js';
import type { HealthCategory, HealthCheck, Severity } from '../../../shared/health.js';

const CATEGORY_LABEL: Record<HealthCategory, string> = {
  'mcp-auth': 'MCP Authentication',
  'mcp-runtime': 'MCP Runtime',
  'config-drift': 'Config Drift',
  symlink: 'Symlinks',
};

const SEVERITY_COLOR: Record<Severity, 'success' | 'warning' | 'error'> = {
  ok: 'success',
  warning: 'warning',
  error: 'error',
};

const CATEGORY_ORDER: readonly HealthCategory[] = [
  'mcp-auth',
  'mcp-runtime',
  'config-drift',
  'symlink',
];

function groupByCategory(checks: HealthCheck[]): Map<HealthCategory, HealthCheck[]> {
  const groups = new Map<HealthCategory, HealthCheck[]>();
  for (const category of CATEGORY_ORDER) {
    const items = checks.filter((c) => c.category === category);
    if (items.length > 0) groups.set(category, items);
  }
  return groups;
}

export function HealthScreen(): React.ReactElement {
  const { data, isLoading, refetch, isFetching } = useHealthReport('personal');

  const checks = data?.checks ?? [];
  const actionable = checks.filter((c) => c.severity !== 'ok');
  const groups = groupByCategory(checks);

  return (
    <Container component="main" data-testid="health-screen" maxWidth="lg" sx={{ py: 2.5 }}>
      <Stack direction="row" sx={{ mb: 2, justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h5" component="h1">
            Diagnostics
          </Typography>
          {data && (
            <Typography variant="body2" color="text.secondary">
              {data.counts.error} error(s), {data.counts.warning} warning(s),{' '}
              {data.counts.ok} ok
            </Typography>
          )}
        </Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={<RefreshIcon />}
          data-testid="health-refresh"
          disabled={isFetching}
          onClick={() => void refetch()}
        >
          Refresh
        </Button>
      </Stack>

      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={24} />
        </Box>
      )}

      {!isLoading && actionable.length === 0 && (
        <Box
          data-testid="health-all-clear"
          sx={{
            border: 1,
            borderStyle: 'dashed',
            borderColor: 'divider',
            borderRadius: 1,
            p: 4,
            textAlign: 'center',
            color: 'text.secondary',
          }}
        >
          <CheckCircleIcon color="success" sx={{ fontSize: 40, mb: 1 }} />
          <Typography variant="body1">Everything looks healthy.</Typography>
        </Box>
      )}

      {!isLoading &&
        actionable.length > 0 &&
        [...groups.entries()].map(([category, items]) => (
          <Box key={category} data-testid={`health-category-${category}`} sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
              {CATEGORY_LABEL[category]}
            </Typography>
            <Stack
              divider={<Divider />}
              sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}
            >
              {items.map((check) => (
                <Box
                  key={check.id}
                  data-testid={`health-check-${check.id}`}
                  sx={{ p: 1.5, display: 'flex', gap: 1.5, alignItems: 'flex-start' }}
                >
                  <Chip
                    size="small"
                    label={check.severity}
                    color={SEVERITY_COLOR[check.severity]}
                    variant="outlined"
                  />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2">{check.title}</Typography>
                    {check.detail && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block' }}
                      >
                        {check.detail}
                      </Typography>
                    )}
                    {check.remediation && (
                      <Typography variant="caption" color="primary" sx={{ display: 'block' }}>
                        {check.remediation}
                      </Typography>
                    )}
                  </Box>
                </Box>
              ))}
            </Stack>
          </Box>
        ))}
    </Container>
  );
}
