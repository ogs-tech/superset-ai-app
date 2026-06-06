import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
} from '@mui/material';

interface ConfirmDisableModalProps {
  adapterName: string;
  count: number;
  onConfirmRemove: () => void;
  onConfirmNoRemove: () => void;
  onCancel: () => void;
}

export function ConfirmDisableModal({
  adapterName,
  count,
  onConfirmRemove,
  onConfirmNoRemove,
  onCancel,
}: ConfirmDisableModalProps): React.ReactElement {
  return (
    <Dialog
      open
      onClose={onCancel}
      aria-labelledby="confirm-disable-title"
      data-testid="confirm-disable-modal"
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle id="confirm-disable-title">Desabilitar {adapterName}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Existem <strong>{count}</strong> symlinks gerenciados por este adapter.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
          <Button
            data-testid="confirm-cancel-btn"
            onClick={onCancel}
          >
            Cancelar
          </Button>
          <Button
            data-testid="confirm-no-remove-btn"
            onClick={onConfirmNoRemove}
            variant="outlined"
          >
            Não, apenas desabilitar
          </Button>
          <Button
            data-testid="confirm-remove-btn"
            onClick={onConfirmRemove}
            variant="contained"
            color="error"
          >
            Sim, remover {count} symlinks
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
