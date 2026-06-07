import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { mockApi, ok, renderWithQuery, type CallSpy } from '../../test-utils.js';
import { McpList } from '../../../../src/renderer/screens/mcps/McpList.js';
import type { McpServer } from '../../../../src/shared/mcp.js';

const servers: McpServer[] = [
  {
    id: 'a', name: 'pencil', transport: 'stdio', def: { command: 'x' },
    scope: 'global', source: { kind: 'workspace' }, enabled: true,
    health: { state: 'error', detail: 'boom' },
  },
  {
    id: 'b', name: 'serena', transport: 'stdio', def: { command: 'x' }, scope: 'plugin',
    source: { kind: 'plugin', pluginId: 'serena', provenance: 'claude-code' }, enabled: true,
  },
];

let call: CallSpy;

beforeEach(() => {
  call = mockApi();
});

function renderScreen() {
  call.mockResolvedValue(ok(servers));
  return renderWithQuery(<McpList />);
}

describe('McpList', () => {
  it('lists servers with name and health', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByText('pencil')).toBeInTheDocument());
    expect(screen.getByText('serena')).toBeInTheDocument();
  });

  it('shows a read-only plugin badge for plugin servers', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('plugin-origin-badge-serena')).toBeInTheDocument());
  });
});
