import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Settings as SettingsScreen } from '../../../src/renderer/screens/Settings.js';
import { mockApi, ok, type CallSpy } from '../test-utils.js';
import type { Settings } from '../../../src/shared/settings.js';

const copilotEnabledSettings: Settings = {
  workspacePath: '/ws',
  adapters: {
    claude: { enabled: false },
    copilot: { enabled: true, exclusiveSkillsWithClaude: false },
  },
  linkedRepos: [],
  ui: { theme: 'system' },
};

let call: CallSpy;

beforeEach(() => {
  call = mockApi();
});

const setupRoute = (initial: Settings = copilotEnabledSettings) => {
  call.mockImplementation((method: string) => {
    if (method === 'settings.get') return Promise.resolve(ok(initial));
    if (method === 'repo.list') return Promise.resolve(ok([]));
    if (method === 'copilot.regenerateInstructions') {
      return Promise.resolve(ok({ path: '/ws/_generated/copilot-instructions.md', refsIncluded: 3 }));
    }
    return Promise.resolve(ok(undefined));
  });
};

describe('<Settings> — Regenerate Copilot instructions (AC#14)', () => {
  it('clicking the button calls copilot.regenerateInstructions once', async () => {
    const user = userEvent.setup();
    setupRoute();
    render(<SettingsScreen />);

    const btn = await screen.findByTestId('regen-copilot-btn');
    await user.click(btn);

    await waitFor(() =>
      expect(call).toHaveBeenCalledWith('copilot.regenerateInstructions', {}),
    );
    expect(call).toHaveBeenCalledTimes(
      call.mock.calls.filter((c) => c[0] === 'copilot.regenerateInstructions').length +
      call.mock.calls.filter((c) => c[0] !== 'copilot.regenerateInstructions').length,
    );
    const regenCalls = call.mock.calls.filter((c) => c[0] === 'copilot.regenerateInstructions');
    expect(regenCalls).toHaveLength(1);
  });

  it('shows toast with refsIncluded count after regeneration', async () => {
    const user = userEvent.setup();
    setupRoute();
    render(<SettingsScreen />);

    const btn = await screen.findByTestId('regen-copilot-btn');
    await user.click(btn);

    await waitFor(() =>
      expect(screen.getByTestId('regen-copilot-toast')).toHaveTextContent('3 references aggregated'),
    );
  });

  it('button is not visible when copilot is disabled', async () => {
    setupRoute({
      ...copilotEnabledSettings,
      adapters: { claude: { enabled: false }, copilot: { enabled: false, exclusiveSkillsWithClaude: false } },
    });
    render(<SettingsScreen />);

    await screen.findByText('Settings');
    expect(screen.queryByTestId('regen-copilot-btn')).toBeNull();
  });
});
