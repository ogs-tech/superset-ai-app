import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { Sparkles } from 'lucide-react';
import { createAppTheme } from '../../../../src/renderer/theme.js';
import { EmptyState } from '../../../../src/renderer/components/ds/EmptyState.js';

const wrap = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={createAppTheme('light')}>{ui}</ThemeProvider>);

describe('EmptyState', () => {
  it('renders title, description and CTA', () => {
    wrap(<EmptyState glyph={Sparkles} title="Nenhuma skill ainda" description="Crie a primeira." cta={<button>Criar skill</button>} testId="skill" />);
    expect(screen.getByTestId('empty-state-skill')).toBeInTheDocument();
    expect(screen.getByText('Nenhuma skill ainda')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar skill' })).toBeInTheDocument();
  });
});
