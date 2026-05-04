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
    <div role="dialog" aria-labelledby="confirm-disable-title" data-testid="confirm-disable-modal">
      <h2 id="confirm-disable-title">Desligar {adapterName}</h2>
      <p>
        Existem <strong>{count}</strong> symlinks gerenciados por este adapter.
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          data-testid="confirm-remove-btn"
          onClick={onConfirmRemove}
        >
          Sim, remover {count} symlinks
        </button>
        <button
          type="button"
          data-testid="confirm-no-remove-btn"
          onClick={onConfirmNoRemove}
        >
          Não, só desligar
        </button>
        <button
          type="button"
          data-testid="confirm-cancel-btn"
          onClick={onCancel}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
