import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkspaceMissing } from '../../../src/renderer/screens/WorkspaceMissing.js';
import { mockApi, ok, type CallSpy } from '../test-utils.js';

let call: CallSpy;

beforeEach(() => {
  call = mockApi();
});

describe('<WorkspaceMissing>', () => {
  it('shows "Re-selecionar pasta" and "Cancelar" buttons', () => {
    render(<WorkspaceMissing onResolved={vi.fn()} onCancel={vi.fn()} />);

    expect(
      screen.getByRole('button', { name: /re-selecionar pasta/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /cancelar/i }),
    ).toBeInTheDocument();
  });

  it('clicking "Re-selecionar" calls dialog.selectFolder + settings.merge with only workspacePath', async () => {
    const user = userEvent.setup();
    call.mockImplementation((method: string) => {
      if (method === 'dialog.selectFolder')
        return Promise.resolve(ok({ canceled: false, path: '/new-ws' }));
      if (method === 'settings.merge') return Promise.resolve(ok({}));
      return Promise.resolve(ok(undefined));
    });

    const onResolved = vi.fn();
    render(<WorkspaceMissing onResolved={onResolved} onCancel={vi.fn()} />);
    await user.click(
      screen.getByRole('button', { name: /re-selecionar pasta/i }),
    );

    await waitFor(() =>
      expect(call).toHaveBeenCalledWith('dialog.selectFolder', expect.any(Object)),
    );
    await waitFor(() =>
      expect(call).toHaveBeenCalledWith('settings.merge', {
        workspacePath: '/new-ws',
      }),
    );

    const mergeCall = call.mock.calls.find((c) => c[0] === 'settings.merge');
    expect(mergeCall?.[1]).toEqual({ workspacePath: '/new-ws' });
    expect(onResolved).toHaveBeenCalled();
  });

  it('clicking "Cancelar" invokes onCancel and does not call settings.merge', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    call.mockResolvedValue(ok(undefined));
    render(<WorkspaceMissing onResolved={vi.fn()} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(call).not.toHaveBeenCalledWith('settings.merge', expect.anything());
  });
});
