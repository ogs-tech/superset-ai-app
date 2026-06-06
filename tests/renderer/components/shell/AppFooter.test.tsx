import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { AppFooter } from '../../../../src/renderer/components/shell/AppFooter.js';
import { renderWithTheme } from '../../test-utils.js';

describe('AppFooter', () => {
  it('carries the OGS brand line', () => {
    renderWithTheme(<AppFooter />);
    expect(screen.getByTestId('app-footer')).toBeInTheDocument();
    expect(screen.getByText(/OGS · TECNOLOGIA BRASIL/i)).toBeInTheDocument();
  });
});
