import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Settings as SettingsScreen } from '../../../../src/renderer/screens/Settings.js';
import { mockApi, ok, renderWithTheme, type CallSpy } from '../../test-utils.js';
import type { Settings } from '../../../../src/shared/settings.js';

let call: CallSpy;
beforeEach(() => { call = mockApi(); });

const route = (cursorEnabled: boolean, repos: unknown[]) => {
  const settings: Settings = {
    adapters: { claude: { enabled: true }, cursor: { enabled: cursorEnabled } },
    linkedRepos: [], ui: { theme: 'system' }, language: 'off',
  };
  call.mockImplementation((method: string) => {
    if (method === 'settings.get') return Promise.resolve(ok(settings));
    if (method === 'repo.list') return Promise.resolve(ok(repos));
    return Promise.resolve(ok(undefined));
  });
};

describe('<Settings> — cursor link-a-repo notice', () => {
  it('shows the notice when cursor is enabled and no repo is linked', async () => {
    route(true, []);
    renderWithTheme(<SettingsScreen />);
    expect(await screen.findByTestId('cursor-no-repo-notice')).toBeInTheDocument();
  });

  it('hides the notice when a repo is linked', async () => {
    route(true, [{ id: 'r', name: 'app', path: '/repos/app', branch: 'main' }]);
    renderWithTheme(<SettingsScreen />);
    await waitFor(() => expect(screen.queryByTestId('cursor-no-repo-notice')).not.toBeInTheDocument());
  });

  it('hides the notice when cursor is disabled', async () => {
    route(false, []);
    renderWithTheme(<SettingsScreen />);
    await waitFor(() => expect(screen.queryByTestId('cursor-no-repo-notice')).not.toBeInTheDocument());
  });

  it('clicking the link-repo action opens the folder picker', async () => {
    const user = userEvent.setup();
    route(true, []);
    call.mockImplementation((method: string) => {
      if (method === 'settings.get')
        return Promise.resolve(
          ok({
            adapters: { claude: { enabled: true }, cursor: { enabled: true } },
            linkedRepos: [],
            ui: { theme: 'system' },
            language: 'off',
          }),
        );
      if (method === 'repo.list') return Promise.resolve(ok([]));
      if (method === 'dialog.selectFolder') return Promise.resolve(ok({ canceled: true }));
      return Promise.resolve(ok(undefined));
    });
    renderWithTheme(<SettingsScreen />);

    const linkButton = await screen.findByTestId('cursor-no-repo-link-button');
    await user.click(linkButton);

    await waitFor(() =>
      expect(call).toHaveBeenCalledWith('dialog.selectFolder', {}),
    );
  });
});
