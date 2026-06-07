import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { mockApi, ok, renderWithQuery, type CallSpy } from '../../test-utils.js';
import { McpEditorDialog } from '../../../../src/renderer/screens/mcps/McpEditorDialog.js';

let call: CallSpy;

beforeEach(() => {
  call = mockApi();
});

function renderDialog(onClose = vi.fn()) {
  call.mockResolvedValue(ok({ ok: true }));
  return renderWithQuery(<McpEditorDialog open mode="create" onClose={onClose} />);
}

describe('McpEditorDialog', () => {
  it('creates a stdio server via mcp.save', async () => {
    const onClose = vi.fn();
    renderDialog(onClose);

    fireEvent.change(screen.getByTestId('mcp-name-input').querySelector('input')!, {
      target: { value: 'pencil' },
    });
    fireEvent.change(screen.getByTestId('mcp-command-input').querySelector('input')!, {
      target: { value: 'pencil-mcp' },
    });
    fireEvent.click(screen.getByTestId('mcp-save'));

    await waitFor(() =>
      expect(call).toHaveBeenCalledWith('mcp.save', expect.objectContaining({
        server: expect.objectContaining({ name: 'pencil', scope: 'global', def: { command: 'pencil-mcp' } }),
        isCreate: true,
      })),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('renders edit mode title when mode is edit', () => {
    call.mockResolvedValue(ok({ ok: true }));
    renderWithQuery(
      <McpEditorDialog
        open
        mode="edit"
        initial={{
          id: 'srv1',
          name: 'my-server',
          transport: 'http',
          def: { type: 'http', url: 'https://example.com' },
          scope: 'global',
          source: { kind: 'workspace' },
          enabled: true,
        }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Edit MCP server')).toBeInTheDocument();
    // URL field should be visible for http transport
    expect(screen.getByTestId('mcp-url-input')).toBeInTheDocument();
  });
});
