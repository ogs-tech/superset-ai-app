import { Alert, AlertTitle, Button } from '@mui/material';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  testId?: string;
}

export function ErrorState({ message, onRetry, testId }: ErrorStateProps): React.ReactElement {
  return (
    <Alert
      {...(testId ? { 'data-testid': `error-state-${testId}` } : {})}
      severity="error"
      variant="outlined"
      sx={(theme) => ({ borderLeft: `4px solid ${theme.palette.error.main}` })}
      action={
        onRetry !== undefined ? (
          <Button color="inherit" size="small" onClick={onRetry}>Tentar novamente</Button>
        ) : undefined
      }
    >
      <AlertTitle>Erro</AlertTitle>
      {message}
    </Alert>
  );
}
