import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { createAppTheme } from '../../../../src/renderer/theme.js';
import { LoadingState } from '../../../../src/renderer/components/ds/LoadingState.js';

describe('LoadingState', () => {
  it('renders skeletons for the requested kind', () => {
    render(<ThemeProvider theme={createAppTheme('light')}><LoadingState kind="list" testId="skill" /></ThemeProvider>);
    expect(screen.getByTestId('loading-state-skill')).toBeInTheDocument();
  });
});
