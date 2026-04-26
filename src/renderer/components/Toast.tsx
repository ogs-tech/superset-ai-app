import { useEffect } from 'react';

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

export function Toast({ toast, onDismiss, durationMs = 4000 }: ToastProps): React.ReactElement | null {
  useEffect(() => {
    if (!toast) return;
    const handle = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(handle);
  }, [toast, onDismiss, durationMs]);

  if (!toast) return null;

  return (
    <div
      role={toast.variant === 'error' ? 'alert' : 'status'}
      data-testid="toast"
      data-variant={toast.variant}
      style={{
        position: 'fixed',
        bottom: '1rem',
        right: '1rem',
        background: toast.variant === 'error' ? '#fee' : '#efe',
        color: toast.variant === 'error' ? '#900' : '#070',
        padding: '0.75rem 1rem',
        border: `1px solid ${toast.variant === 'error' ? '#c00' : '#0a0'}`,
        borderRadius: 6,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {toast.message}
    </div>
  );
}
