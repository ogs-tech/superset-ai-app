import {
  Box,
  Button,
  CircularProgress,
  Container,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import { RefreshCw, CheckCircle2 } from 'lucide-react';
import { Icon } from '../../components/ds/Icon.js';
import { Kicker } from '../../components/ds/Kicker.js';
import { ScreenHeader } from '../../components/ds/ScreenHeader.js';
import { StatusPill } from '../../components/ds/StatusPill.js';
import { useHealthReport } from '../../hooks/use-health-report.js';
import type { HealthCategory, HealthCheck, Severity } from '../../../shared/health.js';

const CATEGORY_LABEL: Record<HealthCategory, string> = {
  'mcp-auth': 'MCP Authentication',
  'mcp-runtime': 'MCP Runtime',
  'config-drift': 'Config Drift',
  symlink: 'Symlinks',
};

const SEVERITY_PILL: Record<Severity, 'ok' | 'warning' | 'error'> = {
  ok: 'ok',
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
      <ScreenHeader
        kicker="Diagnóstico"
        title="Diagnostics"
        subtitle={
          data
            ? `${data.counts.error} error(s), ${data.counts.warning} warning(s), ${data.counts.ok} ok`
            : undefined
        }
        actions={
          <Button
            variant="outlined"
            size="small"
            startIcon={<Icon glyph={RefreshCw} size={16} />}
            data-testid="health-refresh"
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            Refresh
          </Button>
        }
      />

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
          <Box component="span" sx={{ color: 'success.main', display: 'inline-flex', mb: 1 }}>
            <Icon glyph={CheckCircle2} size={40} />
          </Box>
          <Typography variant="body1">Everything looks healthy.</Typography>
        </Box>
      )}

      {!isLoading &&
        actionable.length > 0 &&
        [...groups.entries()].map(([category, items]) => (
          <Box key={category} data-testid={`health-category-${category}`} sx={{ mb: 3 }}>
            <Box sx={{ mb: 1 }}>
              <Kicker>{CATEGORY_LABEL[category]}</Kicker>
            </Box>
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
                  <StatusPill variant={SEVERITY_PILL[check.severity]} />
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
