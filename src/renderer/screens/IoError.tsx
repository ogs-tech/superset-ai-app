import { Alert, Button, Container, Stack } from '@mui/material';
import { ScreenHeader } from '../components/ds/ScreenHeader.js';

interface IoErrorProps {
  message: string;
  onRetry: () => void;
  onCancel: () => void;
}

export function IoError({ message, onRetry, onCancel }: IoErrorProps): React.ReactElement {
  return (
    <Container component="main" data-testid="io-error-screen" maxWidth="sm" sx={{ py: 6 }}>
      <ScreenHeader kicker="Sistema" title="I/O error" />
      <Stack spacing={3} sx={{ alignItems: 'flex-start' }}>
        <Alert
          severity="error"
          variant="outlined"
          role="alert"
          sx={(theme) => ({ width: '100%', borderLeft: `4px solid ${theme.palette.error.main}` })}
        >
          {message}
        </Alert>
        <Stack direction="row" spacing={1.5}>
          <Button variant="contained" onClick={onRetry}>
            Tentar novamente
          </Button>
          <Button variant="outlined" onClick={onCancel}>
            Cancelar
          </Button>
        </Stack>
      </Stack>
    </Container>
  );
}
