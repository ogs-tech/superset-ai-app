import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Main } from '../../../src/renderer/screens/Main.js';
import { mockApi, ok, fail, type CallSpy } from '../test-utils.js';

let call: CallSpy;

beforeEach(() => {
  call = mockApi();
});

const setupRoute = (overrides: Record<string, unknown> = {}) => {
  call.mockImplementation((method: string) => {
    if (method in overrides) return Promise.resolve(overrides[method]);
    if (method === 'global-instruction.get') {
      return Promise.resolve(fail('not_found', 'no global instruction'));
    }
    if (method === 'customization.list') return Promise.resolve(ok([]));
    if (method === 'skill.list') return Promise.resolve(ok([]));
    if (method === 'agent.list') return Promise.resolve(ok([]));
    if (method === 'command.list') return Promise.resolve(ok([]));
    if (method === 'reference.list') return Promise.resolve(ok([]));
    if (method === 'plugin.list') return Promise.resolve(ok([]));
    if (method === 'marketplace.list') return Promise.resolve(ok([]));
    return Promise.resolve(ok(undefined));
  });
};

describe('<Main> — home view', () => {
  it('renders the home dashboard and sidebar by default', async () => {
    setupRoute();
    render(<Main onOpenSettings={() => undefined} />);

    expect(await screen.findByTestId('home-screen')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-settings')).toBeInTheDocument();
  });

  it('navigates to the skills list when the sidebar Skills item is clicked', async () => {
    setupRoute();
    render(<Main onOpenSettings={() => undefined} />);

    await screen.findByTestId('home-screen');
    await userEvent.click(screen.getByTestId('sidebar-skills'));

    expect(await screen.findByTestId('entity-list-skill')).toBeInTheDocument();
  });

  it('does not render linked repos UI in the home view', async () => {
    setupRoute();
    render(<Main onOpenSettings={() => undefined} />);

    await screen.findByTestId('home-screen');
    expect(screen.queryByRole('button', { name: /add repo/i })).toBeNull();
    expect(screen.queryByText(/linked repos/i)).toBeNull();
  });
});
