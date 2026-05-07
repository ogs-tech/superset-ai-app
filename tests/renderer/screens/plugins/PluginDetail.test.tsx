import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { PluginDetail } from '../../../../src/renderer/screens/plugins/PluginDetail.js';
import { mockApi, ok, renderWithQuery, type CallSpy } from '../../test-utils.js';

let call: CallSpy;

const importedDetail = {
  id: 'my-plugin',
  origin: 'imported' as const,
  scope: 'personal' as const,
  enabled: true,
  installedAt: '2026-05-01T00:00:00Z',
  source: { kind: 'git' as const, url: 'https://github.com/x/y' },
  installedRef: { kind: 'branch' as const, value: 'main' },
  manifest: {
    id: 'my-plugin',
    version: '1.2.3',
    description: 'A useful plugin',
    artifacts: {
      skills: ['s1'],
      agents: ['a1'],
      commands: ['c1'],
      hooks: 0,
      mcp: false,
      lsp: false,
    },
  },
};

beforeEach(() => {
  call = mockApi();
  call.mockImplementation((method: string) => {
    if (method === 'plugin.get') return Promise.resolve(ok(importedDetail));
    if (method === 'skill.list') return Promise.resolve(ok([]));
    if (method === 'agent.list') return Promise.resolve(ok([]));
    if (method === 'command.list') return Promise.resolve(ok([]));
    return Promise.resolve(ok(undefined));
  });
});

describe('<PluginDetail>', () => {
  it('renders plugin info from plugin.get', async () => {
    renderWithQuery(<PluginDetail pluginId="my-plugin" scope="personal" />);
    expect(await screen.findByText('1.2.3')).toBeInTheDocument();
    expect(screen.getByText('A useful plugin')).toBeInTheDocument();
    expect(screen.getByText('imported')).toBeInTheDocument();
  });

  it('does not render its own header or close button (drawer provides those)', async () => {
    renderWithQuery(<PluginDetail pluginId="my-plugin" scope="personal" />);
    await screen.findByText('1.2.3');
    expect(screen.queryByText(/^Plugin: my-plugin/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Close$/i })).not.toBeInTheDocument();
  });

  it('does not render Open editor / Publish action buttons', async () => {
    call.mockImplementation((method: string) => {
      if (method === 'plugin.get')
        return Promise.resolve(
          ok({ ...importedDetail, origin: 'owned' as const }),
        );
      if (method === 'skill.list') return Promise.resolve(ok([]));
      if (method === 'agent.list') return Promise.resolve(ok([]));
      if (method === 'command.list') return Promise.resolve(ok([]));
      return Promise.resolve(ok(undefined));
    });
    renderWithQuery(<PluginDetail pluginId="my-plugin" scope="personal" />);
    await screen.findByText('1.2.3');
    expect(
      screen.queryByRole('button', { name: /open editor/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^publish$/i }),
    ).not.toBeInTheDocument();
  });

  it('shows error message when plugin.get fails', async () => {
    call.mockImplementation((method: string) => {
      if (method === 'plugin.get')
        return Promise.resolve({
          ok: false,
          error: { kind: 'unknown' as const, message: 'load failed' },
        });
      if (method === 'skill.list') return Promise.resolve(ok([]));
      if (method === 'agent.list') return Promise.resolve(ok([]));
      if (method === 'command.list') return Promise.resolve(ok([]));
      return Promise.resolve(ok(undefined));
    });
    renderWithQuery(<PluginDetail pluginId="my-plugin" scope="personal" />);
    await waitFor(() => {
      expect(screen.getByText(/load failed/i)).toBeInTheDocument();
    });
  });
});
