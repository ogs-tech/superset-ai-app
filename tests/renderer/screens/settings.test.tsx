import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Settings as SettingsScreen } from '../../../src/renderer/screens/Settings.js';
import { mockApi, ok, type CallSpy } from '../test-utils.js';
import type { LinkedRepoView, Settings } from '../../../src/shared/settings.js';

const baseSettings: Settings = {
  workspacePath: '/ws',
  adapters: {
    claude: { enabled: true, defaultScope: 'personal' },
    copilot: { enabled: false, defaultScope: 'personal' },
  },
  linkedRepos: [],
  ui: { theme: 'system' },
};

let call: CallSpy;

beforeEach(() => {
  call = mockApi();
});

const setupRoute = (
  initial: Settings = baseSettings,
  list: LinkedRepoView[] = [],
  overrides: Record<string, unknown> = {},
) => {
  call.mockImplementation((method: string) => {
    if (method in overrides) return Promise.resolve(overrides[method]);
    if (method === 'settings.get') return Promise.resolve(ok(initial));
    if (method === 'repo.list') return Promise.resolve(ok(list));
    if (method === 'settings.merge') return Promise.resolve(ok(initial));
    return Promise.resolve(ok(undefined));
  });
};

describe('<Settings> — toggles', () => {
  it('toggling claude adapter calls settings.merge with minimal payload', async () => {
    const user = userEvent.setup();
    setupRoute();
    render(<SettingsScreen />);

    const toggle = await screen.findByLabelText('Claude');
    await user.click(toggle);

    await waitFor(() =>
      expect(call).toHaveBeenCalledWith('settings.merge', {
        adapters: { claude: { enabled: false } },
      }),
    );
  });
});

describe('<Settings> — repo linking', () => {
  it('adding a repo whose path lacks .git/ shows error and does not call repo.link', async () => {
    const user = userEvent.setup();
    setupRoute(baseSettings, [], {
      'dialog.selectFolder': ok({ canceled: false, path: '/not-a-repo' }),
      'repo.detectGit': ok(false),
    });
    render(<SettingsScreen />);

    await user.click(await screen.findByRole('button', { name: /add repo/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/not a git/i),
    );
    expect(
      call.mock.calls.find((c) => c[0] === 'repo.link'),
    ).toBeUndefined();
  });

  it('valid repo opens confirmation modal; confirm calls repo.link, cancel does not', async () => {
    const user = userEvent.setup();
    const linked: LinkedRepoView = {
      id: 'x',
      name: 'foo',
      path: '/repos/foo',
      branch: 'main',
    };
    setupRoute(baseSettings, [], {
      'dialog.selectFolder': ok({ canceled: false, path: '/repos/foo' }),
      'repo.detectGit': ok(true),
      'repo.link': ok(linked),
    });
    render(<SettingsScreen />);

    await user.click(await screen.findByRole('button', { name: /add repo/i }));

    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(
      call.mock.calls.find((c) => c[0] === 'repo.link'),
    ).toBeUndefined();

    await user.click(screen.getByRole('button', { name: /add repo/i }));
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: /confirmar/i }));

    await waitFor(() =>
      expect(
        call.mock.calls.find((c) => c[0] === 'repo.link'),
      ).toBeDefined(),
    );
  });

  it('adding the same path twice results in a single entry in the list', async () => {
    const user = userEvent.setup();
    const linked: LinkedRepoView = {
      id: 'x',
      name: 'foo',
      path: '/repos/foo',
      branch: 'main',
    };

    let listCallCount = 0;
    call.mockImplementation((method: string) => {
      if (method === 'settings.get') return Promise.resolve(ok(baseSettings));
      if (method === 'dialog.selectFolder')
        return Promise.resolve(ok({ canceled: false, path: '/repos/foo' }));
      if (method === 'repo.detectGit') return Promise.resolve(ok(true));
      if (method === 'repo.link') return Promise.resolve(ok(linked));
      if (method === 'repo.list') {
        listCallCount += 1;
        return Promise.resolve(ok(listCallCount === 1 ? [] : [linked]));
      }
      return Promise.resolve(ok(undefined));
    });

    render(<SettingsScreen />);

    for (let i = 0; i < 2; i += 1) {
      await user.click(await screen.findByRole('button', { name: /add repo/i }));
      await screen.findByRole('dialog');
      await user.click(screen.getByRole('button', { name: /confirmar/i }));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    }

    const items = screen.getAllByTestId('linked-repo-item');
    expect(items).toHaveLength(1);
  });

  it('confirmation modal mentions "symlink" and "commit"', async () => {
    const user = userEvent.setup();
    setupRoute(baseSettings, [], {
      'dialog.selectFolder': ok({ canceled: false, path: '/repos/foo' }),
      'repo.detectGit': ok(true),
    });
    render(<SettingsScreen />);

    await user.click(await screen.findByRole('button', { name: /add repo/i }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(/symlink/i);
    expect(dialog).toHaveTextContent(/commit/i);
  });
});
