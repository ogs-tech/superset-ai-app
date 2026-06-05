import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Main } from '../../../src/renderer/screens/Main.js';
import { mockApi, ok, fail, renderWithQuery, type CallSpy } from '../test-utils.js';

const render = renderWithQuery;

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

describe('<Main> — landing view', () => {
  it('renders the starter pack as the landing screen and sidebar by default', async () => {
    setupRoute();
    render(<Main onOpenSettings={() => undefined} />);

    expect(await screen.findByTestId('starter-pack-screen')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-settings')).toBeInTheDocument();
  });

  it('navigates to the skills list when the sidebar Skills item is clicked', async () => {
    setupRoute();
    render(<Main onOpenSettings={() => undefined} />);

    await screen.findByTestId('starter-pack-screen');
    await userEvent.click(screen.getByTestId('sidebar-skills'));

    expect(await screen.findByTestId('entity-list-skill')).toBeInTheDocument();
  });

  it('groups entity screens under an expandable Customizations section', async () => {
    setupRoute();
    render(<Main onOpenSettings={() => undefined} />);

    await screen.findByTestId('starter-pack-screen');
    // Groups are expanded by default, so children are reachable immediately.
    const group = screen.getByTestId('sidebar-group-customizations');
    expect(group).toHaveAttribute('aria-expanded', 'true');

    // Collapsing the group hides its children.
    await userEvent.click(group);
    expect(group).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() => expect(screen.queryByTestId('sidebar-agents')).toBeNull());
  });

  it('does not render linked repos UI in the landing view', async () => {
    setupRoute();
    render(<Main onOpenSettings={() => undefined} />);

    await screen.findByTestId('starter-pack-screen');
    expect(screen.queryByRole('button', { name: /add repo/i })).toBeNull();
    expect(screen.queryByText(/linked repos/i)).toBeNull();
  });
});
