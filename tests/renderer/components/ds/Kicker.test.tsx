import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { createAppTheme } from '../../../../src/renderer/theme.js';
import { Kicker } from '../../../../src/renderer/components/ds/Kicker.js';

const wrap = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={createAppTheme('light')}>{ui}</ThemeProvider>);

describe('Kicker', () => {
  it('renders its label in a mono uppercase micro-label', () => {
    wrap(<Kicker>Biblioteca</Kicker>);
    const el = screen.getByText('Biblioteca');
    expect(el).toBeInTheDocument();
    expect(el).toHaveStyle({ textTransform: 'uppercase' });
  });
});
