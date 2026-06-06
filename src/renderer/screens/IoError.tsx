import { Alert, Box, Button, Container, Stack, Typography } from '@mui/material';
import { CircleAlert } from 'lucide-react';
import { Icon } from '../components/ds/Icon.js';

interface IoErrorProps {
  message: string;
  onRetry: () => void;
  onCancel: () => void;
}

export function IoError({ message, onRetry, onCancel }: IoErrorProps): React.ReactElement {
  return (
    <Container component="main" data-testid="io-error-screen" maxWidth="sm" sx={{ py: 6 }}>
      <Stack spacing={3} sx={{ alignItems: 'flex-start' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box component="span" sx={{ color: 'error.main', display: 'inline-flex' }}>
            <Icon glyph={CircleAlert} size={18} />
          </Box>
          <Typography variant="h4" component="h1">
            I/O error
          </Typography>
        </Box>
        <Alert severity="error" role="alert" sx={{ width: '100%' }}>
          {message}
        </Alert>
        <Stack direction="row" spacing={1.5}>
          <Button variant="contained" onClick={onRetry}>
            Retry
          </Button>
          <Button variant="outlined" onClick={onCancel}>
            Cancel
          </Button>
        </Stack>
      </Stack>
    </Container>
  );
}
