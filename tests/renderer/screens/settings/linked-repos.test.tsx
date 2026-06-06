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

describe('<Settings> — linked repos section', () => {
  it('adding a repo whose path lacks .git/ shows error and does not call repo.link', async () => {
    const user = userEvent.setup();
    setupRoute([], {
      'dialog.selectFolder': ok({ canceled: false, path: '/not-a-repo' }),
      'repo.detectGit': ok(false),
    });
    render(<SettingsScreen />);

    await user.click(await screen.findByRole('button', { name: /adicionar repo/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/não é um repositório git/i),
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
    setupRoute([], {
      'dialog.selectFolder': ok({ canceled: false, path: '/repos/foo' }),
      'repo.detectGit': ok(true),
      'repo.link': ok(linked),
    });
    render(<SettingsScreen />);

    await user.click(await screen.findByRole('button', { name: /adicionar repo/i }));

    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    expect(
      call.mock.calls.find((c) => c[0] === 'repo.link'),
    ).toBeUndefined();

    await user.click(screen.getByRole('button', { name: /adicionar repo/i }));
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: /confirm/i }));

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
      await user.click(await screen.findByRole('button', { name: /adicionar repo/i }));
      await screen.findByRole('dialog');
      await user.click(screen.getByRole('button', { name: /confirm/i }));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    }

    const items = screen.getAllByTestId('linked-repo-item');
    expect(items).toHaveLength(1);
  });

  it('confirmation modal mentions "symlink" and "commit"', async () => {
    const user = userEvent.setup();
    setupRoute([], {
      'dialog.selectFolder': ok({ canceled: false, path: '/repos/foo' }),
      'repo.detectGit': ok(true),
    });
    render(<SettingsScreen />);

    await user.click(await screen.findByRole('button', { name: /adicionar repo/i }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(/symlink/i);
    expect(dialog).toHaveTextContent(/commit/i);
  });
});
