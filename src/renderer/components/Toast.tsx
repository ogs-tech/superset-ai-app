import { Alert, Snackbar } from '@mui/material';

export type ToastVariant = 'success' | 'error';

export interface ToastMessage {
  variant: ToastVariant;
  message: string;
}

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
  durationMs?: number;
}

export function Toast({
  toast,
  onDismiss,
  durationMs = 4000,
}: ToastProps): React.ReactElement | null {
  return (
    <Snackbar
      open={toast !== null}
      autoHideDuration={durationMs}
      onClose={onDismiss}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
    >
      {toast ? (
        <Alert
          onClose={onDismiss}
          severity={toast.variant}
          variant="filled"
          data-testid="toast"
          data-variant={toast.variant}
          sx={{ whiteSpace: 'pre-line', maxWidth: 480 }}
        >
          {toast.message}
        </Alert>
      ) : undefined}
    </Snackbar>
  );
}
