import { describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { mockApi, ok, renderWithQuery, type CallSpy } from '../../test-utils.js';
import { McpList } from '../../../../src/renderer/screens/mcps/McpList.js';
import type { McpServer } from '../../../../src/shared/mcp.js';

const servers: McpServer[] = [
  {
    id: 'a',
    name: 'pencil',
    transport: 'stdio',
    def: { command: 'x' },
    scope: 'global',
    source: { kind: 'workspace' },
    enabled: true,
  },
];

let call: CallSpy;

beforeEach(() => {
  call = mockApi();
  call.mockImplementation(async (method: string) => {
    if (method === 'mcp.list') return ok(servers);
    return ok({ ok: true });
  });
});

describe('McpList toggle', () => {
  it('toggling a server calls mcp.setEnabled', async () => {
    renderWithQuery(<McpList />);
    await waitFor(() => expect(screen.getByTestId('mcp-toggle-a')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('mcp-toggle-a').querySelector('input')!);
    await waitFor(() =>
      expect(call).toHaveBeenCalledWith('mcp.setEnabled', { id: 'a', enabled: false }),
    );
  });

  it('switch reflects the enabled state of the server', async () => {
    renderWithQuery(<McpList />);
    await waitFor(() => expect(screen.getByTestId('mcp-toggle-a')).toBeInTheDocument());
    const input = screen.getByTestId('mcp-toggle-a').querySelector('input') as HTMLInputElement;
    expect(input.checked).toBe(true);
  });

  it('plugin rows do not render a toggle', async () => {
    const pluginServer: McpServer = {
      id: 'b',
      name: 'serena',
      transport: 'stdio',
      def: { command: 'x' },
      scope: 'plugin',
      source: { kind: 'plugin', pluginId: 'serena', provenance: 'claude-code' },
      enabled: true,
    };
    call.mockImplementation(async (method: string) => {
      if (method === 'mcp.list') return ok([pluginServer]);
      return ok({ ok: true });
    });
    renderWithQuery(<McpList />);
    await waitFor(() => expect(screen.getByTestId('mcp-row-b')).toBeInTheDocument());
    expect(screen.queryByTestId('mcp-toggle-b')).not.toBeInTheDocument();
  });
});
