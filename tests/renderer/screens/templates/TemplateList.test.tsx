import { describe, it, expect, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TemplateList } from '../../../../src/renderer/screens/templates/TemplateList.js';
import { mockApi, ok, renderWithQuery, type CallSpy } from '../../test-utils.js';

let call: CallSpy;

beforeEach(() => {
  call = mockApi();
});

const sampleTemplate = {
  id: 't1',
  frontmatter: {
    name: 'My Template',
    description: 'desc',
    targetType: 'skill' as const,
    version: '1.0.0',
    scopes: ['personal'],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  body: 'Hello body',
};

describe('<TemplateList>', () => {
  it('opens a drawer when a template card is clicked', async () => {
    call.mockImplementation((method: string) => {
      if (method === 'template.list') return Promise.resolve(ok([sampleTemplate]));
      return Promise.resolve(ok(undefined));
    });
    const user = userEvent.setup();
    renderWithQuery(<TemplateList />);

    const card = await screen.findByTestId('entity-grid-card-template-t1');
    await user.click(card);

    expect(await screen.findByTestId('detail-drawer-template')).toBeInTheDocument();
    expect(screen.getByText('Hello body')).toBeInTheDocument();
  });

  it('closes the drawer and opens the editor when Edit is clicked inside the drawer', async () => {
    call.mockImplementation((method: string) => {
      if (method === 'template.list') return Promise.resolve(ok([sampleTemplate]));
      return Promise.resolve(ok(undefined));
    });
    const user = userEvent.setup();
    renderWithQuery(<TemplateList />);

    // Open the drawer
    const card = await screen.findByTestId('entity-grid-card-template-t1');
    await user.click(card);
    await screen.findByTestId('detail-drawer-template');

    // Click Edit inside the drawer
    const drawer = screen.getByTestId('detail-drawer-template');
    await user.click(within(drawer).getByRole('button', { name: /edit/i }));

    // Drawer must be gone, editor must be present
    expect(screen.queryByTestId('detail-drawer-template')).not.toBeInTheDocument();
    expect(screen.getByTestId('template-editor')).toBeInTheDocument();
  });

  it('does not show the "View" row action (replaced by row click)', async () => {
    call.mockImplementation((method: string) => {
      if (method === 'template.list') return Promise.resolve(ok([sampleTemplate]));
      return Promise.resolve(ok(undefined));
    });
    renderWithQuery(<TemplateList />);
    await screen.findByTestId('entity-grid-card-template-t1');
    // The row's action buttons render with aria-label set to the action label
    expect(screen.queryByRole('button', { name: 'View' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });
});
