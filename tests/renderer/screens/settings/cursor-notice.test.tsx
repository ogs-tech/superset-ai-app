import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Settings as SettingsScreen } from '../../../../src/renderer/screens/Settings.js';
import { mockApi, ok, renderWithTheme, type CallSpy } from '../../test-utils.js';

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
    return Promise.resolve(ok(undefined));
  });
};

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
  });
});
