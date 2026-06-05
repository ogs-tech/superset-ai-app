import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomizationViewDrawer } from '../../../src/renderer/components/CustomizationViewDrawer.js';
import type { CustomizationListItem } from '../../../src/renderer/hooks/use-customization-list.js';

const workspace: CustomizationListItem = {
  id: 'skill-a',
  frontmatter: {
    name: 'Skill A',
    description: 'a skill',
  } as CustomizationListItem['frontmatter'],
  body: '# Skill body',
  source: { kind: 'workspace' },
};

const plugin: CustomizationListItem = {
  id: 'skill-b',
  frontmatter: {
    name: 'Skill B',
    description: 'plugin-provided',
  } as CustomizationListItem['frontmatter'],
  body: '# Plugin body',
  source: { kind: 'plugin', pluginId: 'my-plugin' },
};

describe('<CustomizationViewDrawer>', () => {
  it('does not render when entity is null', () => {
    render(<CustomizationViewDrawer entity={null} onClose={vi.fn()} onEdit={vi.fn()} />);
    expect(screen.queryByTestId(/detail-drawer/i)).not.toBeInTheDocument();
  });

  it('renders Edit button for workspace items', async () => {
    const onEdit = vi.fn();
    render(<CustomizationViewDrawer entity={workspace} onClose={vi.fn()} onEdit={onEdit} />);
    expect(screen.getByText('Skill body')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledWith(workspace);
  });

  it('hides Edit button and shows read-only notice for plugin items', () => {
    render(<CustomizationViewDrawer entity={plugin} onClose={vi.fn()} onEdit={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.getAllByText(/my-plugin/).length).toBeGreaterThan(0);
  });
});
