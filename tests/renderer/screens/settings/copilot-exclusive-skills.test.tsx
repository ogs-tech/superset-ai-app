import { beforeEach, describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Settings as SettingsScreen } from '../../../../src/renderer/screens/Settings.js';
import { mockApi, ok, type CallSpy } from '../../test-utils.js';
import type { Settings } from '../../../../src/shared/settings.js';

const copilotOn = (exclusiveSkillsWithClaude: boolean): Settings => ({
  adapters: {
    claude: { enabled: true },
    copilot: { enabled: true, exclusiveSkillsWithClaude },
  },
  linkedRepos: [],
  ui: { theme: 'system' },
  language: 'off',
});

let call: CallSpy;

const setup = (initial: Settings): void => {
  call.mockImplementation((method: string) => {
    if (method === 'settings.get') return Promise.resolve(ok(initial));
    if (method === 'repo.list') return Promise.resolve(ok([]));
    if (method === 'settings.merge') return Promise.resolve(ok(initial));
    if (method === 'adapter.removeAll') return Promise.resolve(ok([]));
    if (method === 'adapter.syncAll') return Promise.resolve(ok([]));
    return Promise.resolve(ok(undefined));
  });
};

beforeEach(() => {
  call = mockApi();
});

describe('<Settings> — Copilot exclusive skills checkbox (AC#5)', () => {
  it('checkbox is visible when Copilot is enabled', async () => {
    setup(copilotOn(false));
    render(<SettingsScreen />);

    const checkbox = await screen.findByLabelText(/Skip Copilot skills when Claude is enabled/);
    expect(checkbox).toBeInTheDocument();
  });

  it('checkbox reflects current flag value (false)', async () => {
    setup(copilotOn(false));
    render(<SettingsScreen />);

    const checkbox = await screen.findByLabelText<HTMLInputElement>(/Skip Copilot skills when Claude is enabled/);
    expect(checkbox.checked).toBe(false);
  });

  it('checkbox reflects current flag value (true)', async () => {
    setup(copilotOn(true));
    render(<SettingsScreen />);

    const checkbox = await screen.findByLabelText<HTMLInputElement>(/Skip Copilot skills when Claude is enabled/);
    expect(checkbox.checked).toBe(true);
  });

  it('toggling ON calls removeAll then settings.merge (order matters for cleanup)', async () => {
    const user = userEvent.setup();
    const calls: string[] = [];
    call.mockImplementation((method: string) => {
      calls.push(method);
      if (method === 'settings.get') return Promise.resolve(ok(copilotOn(false)));
      if (method === 'repo.list') return Promise.resolve(ok([]));
      return Promise.resolve(ok(undefined));
    });
    render(<SettingsScreen />);

    const checkbox = await screen.findByLabelText(/Skip Copilot skills when Claude is enabled/);
    await user.click(checkbox);

    await waitFor(() => expect(calls).toContain('adapter.removeAll'));
    await waitFor(() => expect(calls).toContain('settings.merge'));

    const removeIdx = calls.indexOf('adapter.removeAll');
    const mergeIdx = calls.lastIndexOf('settings.merge');
    expect(removeIdx).toBeLessThan(mergeIdx);
  });

  it('toggling OFF calls settings.merge then syncAll (to recreate skill symlinks)', async () => {
    const user = userEvent.setup();
    const calls: string[] = [];
    call.mockImplementation((method: string) => {
      calls.push(method);
      if (method === 'settings.get') return Promise.resolve(ok(copilotOn(true)));
      if (method === 'repo.list') return Promise.resolve(ok([]));
      return Promise.resolve(ok(undefined));
    });
    render(<SettingsScreen />);

    const checkbox = await screen.findByLabelText(/Skip Copilot skills when Claude is enabled/);
    await user.click(checkbox);

    await waitFor(() => expect(calls).toContain('settings.merge'));
    await waitFor(() => expect(calls).toContain('adapter.syncAll'));

    const mergeIdx = calls.lastIndexOf('settings.merge');
    const syncIdx = calls.indexOf('adapter.syncAll');
    expect(mergeIdx).toBeLessThan(syncIdx);
  });
});
