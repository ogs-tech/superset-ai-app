import { useEffect, useState } from 'react';
import { callIpc } from '../lib/ipc.js';
import { SyncReportModal } from '../components/SyncReportModal.js';
import { ConfirmDisableModal } from './settings/ConfirmDisableModal.js';
import type { SyncResult } from '../../shared/artifact.js';
import type { Settings as SettingsModel } from '../../shared/settings.js';

const labelFor = (key: 'claude' | 'copilot'): string =>
  key === 'claude' ? 'Claude' : 'Copilot';

interface SettingsProps {
  onBack?: () => void;
}

export function Settings({ onBack }: SettingsProps = {}): React.ReactElement {
  const [settings, setSettings] = useState<SettingsModel | null>(null);
  const [syncReport, setSyncReport] = useState<SyncResult[]>([]);
  const [disableModal, setDisableModal] = useState<{ key: 'claude' | 'copilot'; count: number } | null>(null);
  const [disableToast, setDisableToast] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const current = await callIpc<SettingsModel | null>('settings.get', {});
      if (current !== null) setSettings(current);
    })();
  }, []);

  const handleExclusiveSkillsToggle = async (value: boolean): Promise<void> => {
    if (value) {
      // Remove copilot destinations first (while resolveDestinations still returns them), then save flag
      await callIpc('adapter.removeAll', { adapterId: 'copilot' });
      await callIpc('settings.merge', { adapters: { copilot: { exclusiveSkillsWithClaude: true } } });
    } else {
      // Save flag first so resolveDestinations resolves destinations again, then recreate
      await callIpc('settings.merge', { adapters: { copilot: { exclusiveSkillsWithClaude: false } } });
      await callIpc('adapter.syncAll', { adapterId: 'copilot' });
    }
    const current = await callIpc<SettingsModel | null>('settings.get', {});
    if (current !== null) setSettings(current);
  };

  const handleAdapterToggle = async (
    key: 'claude' | 'copilot',
    enabled: boolean,
  ): Promise<void> => {
    if (enabled) {
      const result = await callIpc<{ syncReport: SyncResult[] }>('adapter.setEnabled', {
        adapterId: key,
        enabled: true,
      });
      const current = await callIpc<SettingsModel | null>('settings.get', {});
      if (current !== null) setSettings(current);
      if (result.syncReport.some((e) => e.status !== 'ok')) {
        setSyncReport(result.syncReport);
      }
    } else {
      const { count } = await callIpc<{ count: number }>('adapter.countDestinations', { adapterId: key });
      setDisableModal({ key, count });
    }
  };

  const handleDisableConfirm = async (removeSymlinks: boolean): Promise<void> => {
    if (!disableModal) return;
    const { key } = disableModal;
    setDisableModal(null);
    const result = await callIpc<{ removed: number; skipped: number; errors: unknown[] }>(
      'adapter.setEnabled',
      { adapterId: key, enabled: false, removeSymlinks },
    );
    const current = await callIpc<SettingsModel | null>('settings.get', {});
    if (current !== null) setSettings(current);
    if (removeSymlinks) {
      setDisableToast(`${result.removed} removidos, ${result.skipped} ignorados`);
      setTimeout(() => setDisableToast(null), 4000);
    }
  };

  if (settings === null) {
    return <main data-testid="settings-loading">Carregando…</main>;
  }

  return (
    <main
      data-testid="settings-screen"
      style={{ padding: '1.5rem', fontFamily: 'system-ui, sans-serif' }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Settings</h1>
        {onBack && (
          <button type="button" onClick={onBack}>
            Voltar
          </button>
        )}
      </header>

      <section>
        <h2>Workspace</h2>
        <p>
          <code data-testid="settings-workspace-path">{settings.workspacePath}</code>
        </p>
      </section>

      <section>
        <h2>Adapters</h2>
        {(['claude', 'copilot'] as const).map((key) => (
          <div key={key} style={{ marginBottom: '0.5rem' }}>
            <input
              id={`adapter-${key}`}
              type="checkbox"
              checked={settings.adapters[key].enabled}
              onChange={(e) =>
                void handleAdapterToggle(key, e.target.checked)
              }
            />
            <label htmlFor={`adapter-${key}`}>{labelFor(key)}</label>
          </div>
        ))}
        {settings.adapters.copilot.enabled && (
          <div style={{ marginTop: '0.5rem' }}>
            <input
              id="copilot-exclusive-skills"
              type="checkbox"
              checked={settings.adapters.copilot.exclusiveSkillsWithClaude}
              onChange={(e) => void handleExclusiveSkillsToggle(e.target.checked)}
            />
            <label htmlFor="copilot-exclusive-skills" title="Avoids duplicates in VS Code Copilot when Claude is also enabled">
              Skip Copilot skills when Claude is enabled (avoids duplicates in VS Code Copilot)
            </label>
          </div>
        )}
      </section>

      {disableModal !== null && (
        <ConfirmDisableModal
          adapterName={labelFor(disableModal.key)}
          count={disableModal.count}
          onConfirmRemove={() => void handleDisableConfirm(true)}
          onConfirmNoRemove={() => void handleDisableConfirm(false)}
          onCancel={() => setDisableModal(null)}
        />
      )}
      {disableToast !== null && (
        <p data-testid="disable-toast" role="status">{disableToast}</p>
      )}
      <SyncReportModal report={syncReport} onClose={() => setSyncReport([])} />
    </main>
  );
}
