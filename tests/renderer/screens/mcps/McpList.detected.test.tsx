import { describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { mockApi, ok, renderWithQuery, type CallSpy } from '../../test-utils.js';
import { McpList } from '../../../../src/renderer/screens/mcps/McpList.js';
import type { McpServer } from '../../../../src/shared/mcp.js';

const detected: McpServer = {
  id: 'd',
  name: 'claude.ai Gmail',
  def: {},
  scope: 'detected',
  source: { kind: 'detected' },
  enabled: false,
  health: { state: 'needs-auth' },
};

let call: CallSpy;

beforeEach(() => {
  call = mockApi();
  call.mockImplementation(async (method: string) => {
    if (method === 'mcp.list') return ok([detected]);
    return ok({ ok: true });
  });
});

describe('McpList — detected servers', () => {
  it('lists a detected needs-auth server with no edit/delete/toggle controls', async () => {
    renderWithQuery(<McpList />);
    await waitFor(() => expect(screen.getByText('claude.ai Gmail')).toBeInTheDocument());
    expect(screen.queryByTestId('mcp-toggle-d')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mcp-edit-d')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mcp-delete-d')).not.toBeInTheDocument();
  });

  it('offers an Authenticate action that opens the external flow', async () => {
    renderWithQuery(<McpList />);
    await waitFor(() => expect(screen.getByTestId('mcp-authenticate-d')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('mcp-authenticate-d'));
    await waitFor(() =>
      expect(call).toHaveBeenCalledWith('mcp.authenticate', { id: 'd' }),
    );
  });

  it('does not render Authenticate for a healthy server', async () => {
    const healthy: McpServer = {
      id: 'a', name: 'pencil', transport: 'stdio', def: { command: 'x' },
      scope: 'global', source: { kind: 'workspace' }, enabled: true,
    };
    call.mockImplementation(async (method: string) => {
      if (method === 'mcp.list') return ok([healthy]);
      return ok({ ok: true });
    });
    renderWithQuery(<McpList />);
    await waitFor(() => expect(screen.getByTestId('mcp-row-a')).toBeInTheDocument());
    expect(screen.queryByTestId('mcp-authenticate-a')).not.toBeInTheDocument();
  });
});
