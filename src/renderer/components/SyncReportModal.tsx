import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  Stack,
  Typography,
} from '@mui/material';
import type { SyncResult } from '../../shared/customization.js';

interface SyncReportModalProps {
  report: SyncResult[];
  onClose: () => void;
}

const STATUS_LABEL: Record<SyncResult['status'], string> = {
  ok: 'OK',
  conflict: 'Conflict',
  error: 'Error',
};

const STATUS_COLOR: Record<SyncResult['status'], 'success' | 'warning' | 'error'> = {
  ok: 'success',
  conflict: 'warning',
  error: 'error',
};

export function SyncReportModal({
  report,
  onClose,
}: SyncReportModalProps): React.ReactElement | null {
  const issues = report.filter((entry) => entry.status !== 'ok');
  if (issues.length === 0) return null;

  return (
    <Dialog
      open
      onClose={onClose}
      aria-labelledby="sync-report-title"
      data-testid="sync-report-modal"
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle id="sync-report-title">Sync report</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Some destinations need your attention:
        </Typography>
        <List disablePadding>
          {issues.map((entry, index) => (
            <ListItem
              key={`${entry.adapter}-${entry.destination ?? 'null'}-${index}`}
              data-testid="sync-report-item"
              disableGutters
              sx={{
                display: 'block',
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                p: 1.5,
                mb: 1,
              }}
            >
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Typography component="strong" sx={{ fontWeight: 600 }}>
                  {entry.adapter}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: `${STATUS_COLOR[entry.status]}.main`, fontWeight: 500 }}
                >
                  {STATUS_LABEL[entry.status]}
                </Typography>
              </Stack>
              {entry.destination !== null && entry.destination !== undefined && (
                <Box
                  component="code"
                  sx={{
                    display: 'block',
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                    color: 'text.secondary',
                    mt: 0.5,
                  }}
                >
                  {entry.destination}
                </Box>
              )}
              {entry.message !== null && entry.message !== undefined && (
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  {entry.message}
                </Typography>
              )}
              {entry.details?.backupPath !== undefined && (
                <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                  Backup:{' '}
                  <Box component="code" sx={{ fontFamily: 'monospace' }}>
                    {entry.details.backupPath}
                  </Box>
                </Typography>
              )}
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
