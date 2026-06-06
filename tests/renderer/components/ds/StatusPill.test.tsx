import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { createAppTheme } from '../../../../src/renderer/theme.js';
import { StatusPill } from '../../../../src/renderer/components/ds/StatusPill.js';

const wrap = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={createAppTheme('light')}>{ui}</ThemeProvider>);

describe('StatusPill', () => {
  it('renders the provided label', () => {
    wrap(<StatusPill variant="synced" label="synced" />);
    expect(screen.getByText('synced')).toBeInTheDocument();
  });
  it('exposes the variant for testing and styling', () => {
    wrap(<StatusPill variant="plugin" label="my-plugin" testId="origin" />);
    const pill = screen.getByTestId('status-pill-origin');
    expect(pill).toHaveAttribute('data-variant', 'plugin');
  });
  it('defaults the label from the variant when none is given', () => {
    wrap(<StatusPill variant="unsynced" />);
    expect(screen.getByText('unsynced')).toBeInTheDocument();
  });
});
