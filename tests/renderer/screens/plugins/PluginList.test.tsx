import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PluginList } from '../../../../src/renderer/screens/plugins/PluginList.js';
import { mockApi, ok, renderWithQuery, type CallSpy } from '../../test-utils.js';

const summary = {
  id: 'my-plugin',
  origin: 'imported' as const,
  scope: 'personal' as const,
  enabled: true,
  installedAt: '2026-05-01T00:00:00Z',
  source: { kind: 'git' as const, url: 'https://github.com/x/y' },
  installedRef: { kind: 'branch' as const, value: 'main' },
};

const detail = {
  ...summary,
  manifest: {
    id: 'my-plugin',
    version: '1.2.3',
    description: 'A useful plugin',
    artifacts: {
      skills: [],
      agents: [],
      commands: [],
      hooks: 0,
      mcp: false,
      lsp: false,
    },
  },
};

let call: CallSpy;

beforeEach(() => {
  call = mockApi();
  call.mockImplementation((method: string) => {
    if (method === 'plugin.list') return Promise.resolve(ok([summary]));
    if (method === 'plugin.get') return Promise.resolve(ok(detail));
    if (method === 'skill.list') return Promise.resolve(ok([]));
    if (method === 'agent.list') return Promise.resolve(ok([]));
    if (method === 'command.list') return Promise.resolve(ok([]));
    return Promise.resolve(ok(undefined));
  });
});

describe('<PluginList>', () => {
  it('opens plugin detail drawer when a card is clicked', async () => {
    const user = userEvent.setup();
    renderWithQuery(<PluginList scope="personal" />);

    const card = await screen.findByTestId('entity-grid-card-plugin-my-plugin');
    await user.click(card);

    expect(await screen.findByTestId('detail-drawer-plugin')).toBeInTheDocument();
    expect(screen.getByTestId('plugin-list')).toBeInTheDocument();
    expect(await screen.findByTestId('plugin-detail')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(screen.queryByTestId('plugin-detail')).not.toBeInTheDocument();
  });

  it('does not open drawer when clicking the row toggle switch', async () => {
    const user = userEvent.setup();
    renderWithQuery(<PluginList scope="personal" />);

    const toggle = await screen.findByLabelText('Toggle my-plugin');
    await user.click(toggle);

    expect(screen.queryByTestId('detail-drawer-plugin')).not.toBeInTheDocument();
  });
});
