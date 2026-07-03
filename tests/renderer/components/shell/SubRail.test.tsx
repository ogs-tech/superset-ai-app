import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SubRail } from '../../../../src/renderer/components/shell/SubRail.js';
import { renderWithShell } from '../../test-utils.js';

describe('SubRail', () => {
  it('renders nothing for areas without subs', () => {
    const { container } = renderWithShell(<SubRail nav={{ area: 'inicio' }} onSelect={() => undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
  it('renders the five Library subs and marks the active one', () => {
    renderWithShell(<SubRail nav={{ area: 'biblioteca', sub: 'agents' }} onSelect={() => undefined} />);
    expect(screen.getByTestId('nav-skills')).toBeInTheDocument();
    expect(screen.getByTestId('nav-instructions')).toBeInTheDocument();
    expect(screen.getByTestId('nav-agents')).toHaveAttribute('aria-current', 'page');
  });
  it('selects a sub on click', async () => {
    const onSelect = vi.fn();
    renderWithShell(<SubRail nav={{ area: 'biblioteca', sub: 'skills' }} onSelect={onSelect} />);
    await userEvent.click(screen.getByTestId('nav-hooks'));
    expect(onSelect).toHaveBeenCalledWith({ area: 'biblioteca', sub: 'hooks' });
  });
});
