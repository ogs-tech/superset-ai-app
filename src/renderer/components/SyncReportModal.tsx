import type { SyncResult } from '../../shared/customization.js';

interface SyncReportModalProps {
  report: SyncResult[];
  onClose: () => void;
}

const STATUS_LABEL: Record<SyncResult['status'], string> = {
  ok: 'OK',
  conflict: 'Conflito',
  error: 'Erro',
};

export function SyncReportModal({
  report,
  onClose,
}: SyncReportModalProps): React.ReactElement | null {
  const issues = report.filter((entry) => entry.status !== 'ok');
  if (issues.length === 0) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sync-report-title"
      data-testid="sync-report-modal"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 8,
          padding: '1.5rem',
          maxWidth: 520,
          width: '90%',
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
        }}
      >
        <h2 id="sync-report-title" style={{ marginTop: 0 }}>
          Relatório de sincronização
        </h2>
        <p>Alguns destinos exigem sua atenção:</p>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {issues.map((entry, index) => (
            <li
              key={`${entry.adapter}-${entry.destination ?? 'null'}-${index}`}
              data-testid="sync-report-item"
              style={{
                border: '1px solid #ddd',
                borderRadius: 6,
                padding: '0.75rem',
                marginBottom: '0.5rem',
              }}
            >
              <div>
                <strong>{entry.adapter}</strong> — {STATUS_LABEL[entry.status]}
              </div>
              {entry.destination && (
                <div style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>
                  {entry.destination}
                </div>
              )}
              {entry.message && (
                <div style={{ marginTop: '0.25rem' }}>{entry.message}</div>
              )}
              {entry.details?.backupPath && (
                <div style={{ marginTop: '0.25rem', fontSize: '0.85rem' }}>
                  Backup: <code>{entry.details.backupPath}</code>
                </div>
              )}
            </li>
          ))}
        </ul>
        <div style={{ textAlign: 'right', marginTop: '1rem' }}>
          <button type="button" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
