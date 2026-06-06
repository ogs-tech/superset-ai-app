import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material';
import { createAppTheme } from '../../../../src/renderer/theme.js';
import { ErrorState } from '../../../../src/renderer/components/ds/ErrorState.js';

describe('ErrorState', () => {
  it('shows the message and retries on click', async () => {
    const onRetry = vi.fn();
    render(<ThemeProvider theme={createAppTheme('light')}><ErrorState message="Falha ao carregar" onRetry={onRetry} testId="skill" /></ThemeProvider>);
    expect(screen.getByTestId('error-state-skill')).toHaveTextContent('Falha ao carregar');
    await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
