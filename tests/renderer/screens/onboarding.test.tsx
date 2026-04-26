import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Onboarding } from '../../../src/renderer/screens/Onboarding.js';
import { mockApi, ok, fail, type CallSpy } from '../test-utils.js';

let call: CallSpy;

beforeEach(() => {
  call = mockApi();
  call.mockResolvedValue({ ok: true, data: undefined });
});

describe('<Onboarding>', () => {
  it('shows folder selection button referencing default ~/sde-ai-app', () => {
    render(<Onboarding onComplete={vi.fn()} onIoError={vi.fn()} />);

    expect(
      screen.getByRole('button', { name: /selecionar pasta/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/~\/sde-ai-app/)).toBeInTheDocument();
  });

  it('does not contain adapter toggle UI', () => {
    render(<Onboarding onComplete={vi.fn()} onIoError={vi.fn()} />);

    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByText(/claude/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/copilot/i)).not.toBeInTheDocument();
  });

  it('does not contain repo linking UI', () => {
    render(<Onboarding onComplete={vi.fn()} onIoError={vi.fn()} />);

    expect(screen.queryByText(/linked rep/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/add rep/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/link rep/i)).not.toBeInTheDocument();
  });

  it('selecting a folder triggers workspace.bootstrap and settings.merge with defaults', async () => {
    const user = userEvent.setup();
    call.mockImplementation((method: string) => {
      if (method === 'dialog.selectFolder')
        return Promise.resolve(ok({ canceled: false, path: '/picked' }));
      if (method === 'workspace.bootstrap') return Promise.resolve(ok(undefined));
      if (method === 'settings.merge')
        return Promise.resolve(
          ok({
            workspacePath: '/picked',
            adapters: {
              claude: { enabled: true, defaultScope: 'personal' },
              copilot: { enabled: false, defaultScope: 'personal' },
            },
            linkedRepos: [],
            ui: { theme: 'system' },
          }),
        );
      return Promise.resolve(ok(undefined));
    });

    const onComplete = vi.fn();
    render(<Onboarding onComplete={onComplete} onIoError={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /selecionar pasta/i }));

    await waitFor(() =>
      expect(call).toHaveBeenCalledWith('workspace.bootstrap', {
        workspacePath: '/picked',
      }),
    );

    const mergeCall = call.mock.calls.find((c) => c[0] === 'settings.merge');
    expect(mergeCall?.[1]).toMatchObject({
      workspacePath: '/picked',
      adapters: {
        claude: { enabled: true, defaultScope: 'personal' },
        copilot: { enabled: false, defaultScope: 'personal' },
      },
      linkedRepos: [],
      ui: { theme: 'system' },
    });

    await waitFor(() => expect(onComplete).toHaveBeenCalled());
  });

  it('canceling the dialog leaves no IPC side effects beyond the dialog call', async () => {
    const user = userEvent.setup();
    call.mockImplementation((method: string) => {
      if (method === 'dialog.selectFolder')
        return Promise.resolve(ok({ canceled: true }));
      return Promise.resolve(ok(undefined));
    });

    render(<Onboarding onComplete={vi.fn()} onIoError={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /selecionar pasta/i }));

    await waitFor(() =>
      expect(call).toHaveBeenCalledWith('dialog.selectFolder', expect.any(Object)),
    );
    expect(
      call.mock.calls.find((c) => c[0] === 'workspace.bootstrap'),
    ).toBeUndefined();
    expect(
      call.mock.calls.find((c) => c[0] === 'settings.merge'),
    ).toBeUndefined();
  });

  it('I/O failure during workspace.bootstrap routes to onIoError', async () => {
    const user = userEvent.setup();
    call.mockImplementation((method: string) => {
      if (method === 'dialog.selectFolder')
        return Promise.resolve(ok({ canceled: false, path: '/picked' }));
      if (method === 'workspace.bootstrap')
        return Promise.resolve(fail('io', 'EACCES'));
      return Promise.resolve(ok(undefined));
    });

    const onIoError = vi.fn();
    render(<Onboarding onComplete={vi.fn()} onIoError={onIoError} />);
    await user.click(screen.getByRole('button', { name: /selecionar pasta/i }));

    await waitFor(() => expect(onIoError).toHaveBeenCalled());
    const [message, retry] = onIoError.mock.calls[0] ?? [];
    expect(message).toMatch(/EACCES/);
    expect(typeof retry).toBe('function');
  });
});
