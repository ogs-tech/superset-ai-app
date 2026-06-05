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
      <DialogTitle id="confirm-disable-title">Disable {adapterName}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          There are <strong>{count}</strong> symlinks managed by this adapter.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
          <Button data-testid="confirm-cancel-btn" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            data-testid="confirm-no-remove-btn"
            onClick={onConfirmNoRemove}
            variant="outlined"
          >
            No, just disable
          </Button>
          <Button
            data-testid="confirm-remove-btn"
            onClick={onConfirmRemove}
            variant="contained"
            color="error"
          >
            Yes, remove {count} symlinks
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
