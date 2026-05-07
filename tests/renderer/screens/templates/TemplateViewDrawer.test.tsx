import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TemplateViewDrawer } from '../../../../src/renderer/screens/templates/TemplateViewDrawer.js';
import type { Template } from '../../../../src/shared/template.js';

const sample: Template = {
  id: 'skill-starter',
  frontmatter: {
    name: 'Skill Starter',
    description: 'Starting point for skills',
    targetType: 'skill',
    version: '1.0.0',
    scopes: ['personal'],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  body: '# Body\n\nMarkdown content here.',
};

describe('<TemplateViewDrawer>', () => {
  it('does not render when template is null', () => {
    render(
      <TemplateViewDrawer template={null} onClose={vi.fn()} onEdit={vi.fn()} />,
    );
    expect(screen.queryByTestId(/detail-drawer/i)).not.toBeInTheDocument();
  });

  it('renders template name, description and body', () => {
    render(
      <TemplateViewDrawer
        template={sample}
        onClose={vi.fn()}
        onEdit={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Skill Starter' })).toBeInTheDocument();
    expect(screen.getByText('Starting point for skills')).toBeInTheDocument();
    expect(screen.getByText('Markdown content here.')).toBeInTheDocument();
  });

  it('calls onEdit when the Edit button is clicked', async () => {
    const onEdit = vi.fn();
    render(
      <TemplateViewDrawer
        template={sample}
        onClose={vi.fn()}
        onEdit={onEdit}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledWith(sample);
  });
});
