import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MarketplaceList } from '../../../../src/renderer/screens/marketplaces/MarketplaceList.js';
import { mockApi, ok, type CallSpy } from '../../test-utils.js';

let call: CallSpy;

beforeEach(() => {
  call = mockApi();
});

describe('<MarketplaceList>', () => {
  it('renders empty state when no marketplaces', async () => {
    call.mockImplementation((method: string) => {
      if (method === 'marketplace.list') return Promise.resolve(ok([]));
      return Promise.resolve(ok(undefined));
    });
    render(<MarketplaceList />);
    expect(await screen.findByText(/No marketplaces configured yet/i)).toBeInTheDocument();
    expect(screen.getByTestId('import-marketplace-button')).toBeInTheDocument();
  });

  it('renders marketplace items with manifest info', async () => {
    call.mockImplementation((method: string) => {
      if (method === 'marketplace.list')
        return Promise.resolve(
          ok([
            {
              id: 'claude-plugins-official',
              source: { kind: 'directory', path: '/tmp/cpo' },
              manifest: {
                name: 'Claude Plugins Official',
                description: 'official catalog',
                plugins: [{ name: 'p1', description: 'plugin 1', source: 'a' }],
              },
            },
          ]),
        );
      return Promise.resolve(ok(undefined));
    });
    render(<MarketplaceList />);

    expect(
      await screen.findByTestId('marketplace-item-claude-plugins-official'),
    ).toBeInTheDocument();
    expect(screen.getByText('Claude Plugins Official')).toBeInTheDocument();
    expect(screen.getByText(/1 plugin/)).toBeInTheDocument();
  });

  it('opens import dialog when Import from URL clicked', async () => {
    call.mockImplementation((method: string) => {
      if (method === 'marketplace.list') return Promise.resolve(ok([]));
      return Promise.resolve(ok(undefined));
    });
    const user = userEvent.setup();
    render(<MarketplaceList />);
    await screen.findByText(/No marketplaces/i);
    await user.click(screen.getByTestId('import-marketplace-button'));
    expect(screen.getByTestId('marketplace-import-dialog')).toBeInTheDocument();
  });
});
