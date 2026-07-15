import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeModeProvider, useThemeMode } from '../../../src/renderer/lib/theme-mode-context.js';
import { mockApi, ok, type CallSpy } from '../test-utils.js';

let call: CallSpy;
beforeEach(() => {
  call = mockApi();
});

function Probe(): React.ReactElement {
  const { setting, setTheme } = useThemeMode();
  return (
    <div>
      <span data-testid="setting">{setting}</span>
      <button onClick={() => setTheme('dark')}>go dark</button>
    </div>
  );
}

describe('ThemeModeProvider', () => {
  it('reads the persisted theme on mount', async () => {
    call.mockResolvedValue(ok({ ui: { theme: 'dark' }, adapters: { claude: { enabled: true } }, language: 'off' }));
    render(<ThemeModeProvider><Probe /></ThemeModeProvider>);
    await waitFor(() => expect(screen.getByTestId('setting')).toHaveTextContent('dark'));
  });

  it('persists a toggle via settings.merge', async () => {
    call.mockResolvedValue(ok({ ui: { theme: 'system' }, adapters: { claude: { enabled: true } }, language: 'off' }));
    render(<ThemeModeProvider><Probe /></ThemeModeProvider>);
    await userEvent.click(screen.getByRole('button', { name: 'go dark' }));
    expect(call).toHaveBeenCalledWith('settings.merge', { ui: { theme: 'dark' } });
    expect(screen.getByTestId('setting')).toHaveTextContent('dark');
  });
});
