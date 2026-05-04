import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SyncReportModal } from '../../../src/renderer/components/SyncReportModal.js';
import type { SyncResult } from '../../../src/shared/customization.js';

const okResult: SyncResult = {
  adapter: 'claude',
  destination: '/personal/claude/skills/foo',
  status: 'ok',
};

const conflictResult: SyncResult = {
  adapter: 'claude',
  destination: '/personal/claude/skills/foo',
  status: 'conflict',
  message: 'Overwrote existing destination and created a backup',
  details: {
    backupPath: '/workspace/_backups/20260426T100000/personal/claude/skills/foo',
    action: 'overwritten',
  },
};

const errorResult: SyncResult = {
  adapter: 'copilot',
  destination: '/personal/copilot/skills/foo',
  status: 'error',
  message: 'EACCES: permission denied',
};

describe('<SyncReportModal>', () => {
  it('does not render when report is empty', () => {
    const { container } = render(<SyncReportModal report={[]} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('does not render when report contains only ok results', () => {
    const { container } = render(
      <SyncReportModal report={[okResult]} onClose={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders modal with conflict and error entries, hiding ok entries', () => {
    render(
      <SyncReportModal
        report={[okResult, conflictResult, errorResult]}
        onClose={vi.fn()}
      />,
    );

    const modal = screen.getByRole('dialog');
    expect(modal).toBeInTheDocument();
    expect(modal).toHaveTextContent('/personal/claude/skills/foo');
    expect(screen.getAllByTestId('sync-report-item')).toHaveLength(2);
  });

  it('shows adapter, destination, and backup path when present', () => {
    render(
      <SyncReportModal report={[conflictResult]} onClose={vi.fn()} />,
    );

    const item = screen.getByTestId('sync-report-item');
    expect(item).toHaveTextContent('claude');
    expect(item).toHaveTextContent('/personal/claude/skills/foo');
    expect(item).toHaveTextContent(
      '/workspace/_backups/20260426T100000/personal/claude/skills/foo',
    );
  });

  it('omits backup path line when details.backupPath is missing', () => {
    render(<SyncReportModal report={[errorResult]} onClose={vi.fn()} />);

    const item = screen.getByTestId('sync-report-item');
    expect(item).toHaveTextContent('copilot');
    expect(item).not.toHaveTextContent(/_backups\//);
  });

  it('invokes onClose when Fechar is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<SyncReportModal report={[conflictResult]} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: /fechar/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
