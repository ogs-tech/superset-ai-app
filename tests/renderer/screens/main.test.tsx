import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Main } from '../../../src/renderer/screens/Main.js';
import { mockApi, ok, type CallSpy } from '../test-utils.js';

let call: CallSpy;

beforeEach(() => {
  call = mockApi();
});

const setupRoute = (overrides: Record<string, unknown> = {}) => {
  call.mockImplementation((method: string) => {
    if (method in overrides) return Promise.resolve(overrides[method]);
    if (method === 'artifact.list') return Promise.resolve(ok([]));
    return Promise.resolve(ok(undefined));
  });
};

describe('<Main> — home view', () => {
  it('renders the artifact list and the topbar with a settings button', async () => {
    setupRoute();
    render(<Main onOpenSettings={() => undefined} />);

    expect(await screen.findByTestId('artifact-list')).toBeInTheDocument();
    expect(screen.getByTestId('topbar')).toBeInTheDocument();
    expect(screen.getByTestId('topbar-search-input')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /abrir settings/i })).toBeInTheDocument();
  });

  it('does not render linked repos UI in the home view', async () => {
    setupRoute();
    render(<Main onOpenSettings={() => undefined} />);

    await screen.findByTestId('artifact-list');
    expect(screen.queryByRole('button', { name: /add repo/i })).toBeNull();
    expect(screen.queryByText(/linked repos/i)).toBeNull();
  });
});
