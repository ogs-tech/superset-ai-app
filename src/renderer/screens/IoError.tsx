interface IoErrorProps {
  message: string;
  onRetry: () => void;
  onCancel: () => void;
}

export function IoError({ message, onRetry, onCancel }: IoErrorProps): React.ReactElement {
  return (
    <main data-testid="io-error-screen" style={{ padding: '1.5rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Erro de I/O</h1>
      <p role="alert">{message}</p>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="button" onClick={onRetry}>
          Tentar novamente
        </button>
        <button type="button" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </main>
  );
}
