import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Settings as SettingsScreen } from '../../../../src/renderer/screens/Settings.js';
import { mockApi, ok, renderWithTheme, type CallSpy } from '../../test-utils.js';
<<<<<<< HEAD

const render = (ui: React.ReactElement) => renderWithTheme(ui);
import type { LinkedRepoView, Settings } from '../../../../src/shared/settings.js';

const baseSettings: Settings = {
  adapters: {
    claude: { enabled: true },
  },
  linkedRepos: [],
  ui: { theme: 'system' },
  language: 'off',
};

let call: CallSpy;

beforeEach(() => {
  call = mockApi();
});

const setupRoute = (
  list: LinkedRepoView[] = [],
  overrides: Record<string, unknown> = {},
) => {
  call.mockImplementation((method: string) => {
    if (method in overrides) return Promise.resolve(overrides[method]);
    if (method === 'settings.get') return Promise.resolve(ok(baseSettings));
    if (method === 'repo.list') return Promise.resolve(ok(list));
=======
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
>>>>>>> 2accb177ed61ccf75d40bccb1c5fa4707c20ea35
    return Promise.resolve(ok(undefined));
  });
};

<<<<<<< HEAD
describe('<Settings> — cursor adapter no-repo notice', () => {
  it('with cursor enabled and no repos, cursor-no-repo-link-button calls dialog.selectFolder on click', async () => {
    const user = userEvent.setup();
    setupRoute([], {
      'dialog.selectFolder': ok({ canceled: true }),
    });
    render(<SettingsScreen />);

    const button = await screen.findByTestId('cursor-no-repo-link-button');
    await user.click(button);

    await waitFor(() =>
      expect(call).toHaveBeenCalledWith('dialog.selectFolder', expect.anything()),
    );
  });

  it('does not render cursor-no-repo-link-button when repos list is not empty', async () => {
    const linked: LinkedRepoView = {
      id: 'x',
      name: 'foo',
      path: '/repos/foo',
      branch: 'main',
    };
    setupRoute([linked], {});
    render(<SettingsScreen />);

    // Wait for the screen to load
    await screen.findByTestId('settings-screen');

    expect(screen.queryByTestId('cursor-no-repo-link-button')).not.toBeInTheDocument();
  });

  it('does not render cursor-no-repo-link-button when cursor adapter is disabled', async () => {
    const disabledSettings: Settings = {
      adapters: {
        claude: { enabled: false },
      },
      linkedRepos: [],
      ui: { theme: 'system' },
      language: 'off',
    };
    call.mockImplementation((method: string) => {
      if (method === 'settings.get') return Promise.resolve(ok(disabledSettings));
      if (method === 'repo.list') return Promise.resolve(ok([]));
      return Promise.resolve(ok(undefined));
    });
    render(<SettingsScreen />);

    // Wait for the screen to load
    await screen.findByTestId('settings-screen');

    expect(screen.queryByTestId('cursor-no-repo-link-button')).not.toBeInTheDocument();
=======
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
>>>>>>> 2accb177ed61ccf75d40bccb1c5fa4707c20ea35
  });
});
