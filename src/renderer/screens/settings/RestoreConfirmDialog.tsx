import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';

interface RestoreConfirmDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RestoreConfirmDialog({
  open,
  onConfirm,
  onCancel,
}: RestoreConfirmDialogProps): React.ReactElement {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      aria-labelledby="restore-confirm-title"
      data-testid="restore-confirm-dialog"
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle id="restore-confirm-title">Restaurar para estado inicial?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Esta ação irá <strong>deletar permanentemente</strong> os diretórios{' '}
          <code>~/.superset-ai-app</code> e <code>~/.claude</code> e fechar o aplicativo. Isso não
          pode ser desfeito.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button data-testid="restore-cancel-btn" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          data-testid="restore-confirm-btn"
          onClick={onConfirm}
          variant="contained"
          color="error"
        >
          Restaurar e fechar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
