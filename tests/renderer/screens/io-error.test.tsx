import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IoError } from '../../../src/renderer/screens/IoError.js';
import { renderWithTheme } from '../test-utils.js';

const render = (ui: React.ReactElement) => renderWithTheme(ui);

describe('<IoError>', () => {
  it('shows "Tentar novamente" and "Cancelar" buttons', () => {
    render(<IoError onRetry={vi.fn()} onCancel={vi.fn()} message="EACCES" />);

    expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument();
  });

  it('clicking "Tentar novamente" invokes onRetry callback', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<IoError onRetry={onRetry} onCancel={vi.fn()} message="EACCES" />);

    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('clicking "Cancelar" invokes onCancel callback', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<IoError onRetry={vi.fn()} onCancel={onCancel} message="EACCES" />);

    await user.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
