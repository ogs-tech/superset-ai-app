import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Main } from '../../../src/renderer/screens/Main.js';
import {
  mockApi,
  ok,
  fail,
  renderWithShell,
  type CallSpy,
} from '../test-utils.js';

const render = renderWithShell;

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

describe('<Main> — shell navigation', () => {
  it('renders the starter pack as the landing screen inside the shell', async () => {
    setupRoute();
    render(<Main onOpenSettings={() => undefined} />);

    expect(await screen.findByTestId('starter-pack-screen')).toBeInTheDocument();
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByTestId('nav-settings')).toBeInTheDocument();
  });

  it('navigates to the skills list via the Biblioteca sub-rail', async () => {
    setupRoute();
    render(<Main onOpenSettings={() => undefined} />);

    await screen.findByTestId('starter-pack-screen');
    await userEvent.click(screen.getByTestId('nav-biblioteca'));
    await userEvent.click(screen.getByTestId('nav-skills'));

    expect(await screen.findByTestId('entity-list-skill')).toBeInTheDocument();
  });

  it('does not render linked repos UI in the landing view', async () => {
    setupRoute();
    render(<Main onOpenSettings={() => undefined} />);

    await screen.findByTestId('starter-pack-screen');
    expect(screen.queryByRole('button', { name: /add repo/i })).toBeNull();
  });
});
