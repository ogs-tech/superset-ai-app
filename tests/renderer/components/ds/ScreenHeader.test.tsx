import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { createAppTheme } from '../../../../src/renderer/theme.js';
import { ScreenHeader } from '../../../../src/renderer/components/ds/ScreenHeader.js';

const wrap = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={createAppTheme('light')}>{ui}</ThemeProvider>);

describe('ScreenHeader', () => {
  it('renders kicker, title (h1) and subtitle', () => {
    wrap(<ScreenHeader kicker="Biblioteca" title="Skills" subtitle="12 pessoais" />);
    expect(screen.getByText('Biblioteca')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Skills' })).toBeInTheDocument();
    expect(screen.getByText('12 pessoais')).toBeInTheDocument();
  });
  it('renders an actions slot', () => {
    wrap(<ScreenHeader title="Skills" actions={<button>Nova skill</button>} />);
    expect(screen.getByRole('button', { name: 'Nova skill' })).toBeInTheDocument();
  });
});
