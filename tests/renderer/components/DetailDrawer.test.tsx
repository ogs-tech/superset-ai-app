import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DetailDrawer } from '../../../src/renderer/components/DetailDrawer.js';

describe('<DetailDrawer>', () => {
  it('does not render content when closed', () => {
    render(
      <DetailDrawer
        open={false}
        onClose={vi.fn()}
        title="Hello"
        testId="x"
      >
        <div>body</div>
      </DetailDrawer>,
    );
    expect(screen.queryByText('body')).not.toBeInTheDocument();
  });

  it('renders title, subtitle and content when open', () => {
    render(
      <DetailDrawer
        open
        onClose={vi.fn()}
        title="Hello"
        subtitle="world"
        testId="x"
      >
        <div>body</div>
      </DetailDrawer>,
    );
    expect(screen.getByTestId('detail-drawer-x')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hello' })).toBeInTheDocument();
    expect(screen.getByText('world')).toBeInTheDocument();
    expect(screen.getByText('body')).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn();
    render(
      <DetailDrawer open onClose={onClose} title="Hello" testId="x">
        <div>body</div>
      </DetailDrawer>,
    );
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
