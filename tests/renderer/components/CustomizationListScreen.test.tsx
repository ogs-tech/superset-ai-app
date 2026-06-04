import { describe, it, expect, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomizationListScreen } from '../../../src/renderer/components/CustomizationListScreen.js';
import { mockApi, ok, renderWithQuery, type CallSpy } from '../test-utils.js';

let call: CallSpy;

beforeEach(() => {
  call = mockApi();
});

const workspaceSkill = {
  id: 'a',
  frontmatter: {
    name: 'Workspace Skill',
    description: 'desc',
    scopes: ['personal'],
    version: '0.1.0',
    createdAt: '',
    updatedAt: '',
  },
  body: 'workspace body',
  source: { kind: 'workspace' },
};

const pluginSkill = {
  id: 'b',
  frontmatter: { name: 'Plugin Skill', description: 'plugin desc' },
  body: 'plugin body',
  source: { kind: 'plugin', pluginId: 'my-plugin' },
};

function renderScreen() {
  return renderWithQuery(
    <CustomizationListScreen
      entityType="skill"
      title="Skills"
      singular="skill"
      listMethod="skill.list"
      deleteMethod="skill.delete"
    />,
  );
}

describe('<CustomizationListScreen>', () => {
  it('opens a drawer when a workspace card is clicked', async () => {
    call.mockImplementation((method: string) => {
      if (method === 'skill.list') return Promise.resolve(ok([workspaceSkill]));
      return Promise.resolve(ok(undefined));
    });
    const user = userEvent.setup();
    renderScreen();

    const card = await screen.findByTestId('entity-grid-card-skill-workspace/a');
    await user.click(card);

    expect(await screen.findByTestId('detail-drawer-customization')).toBeInTheDocument();
    expect(screen.getByText('workspace body')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  it('hides Edit button in drawer for plugin items', async () => {
    call.mockImplementation((method: string) => {
      if (method === 'skill.list') return Promise.resolve(ok([pluginSkill]));
      return Promise.resolve(ok(undefined));
    });
    const user = userEvent.setup();
    renderScreen();

    const card = await screen.findByTestId('entity-grid-card-skill-plugin/b');
    await user.click(card);

    expect(await screen.findByTestId('detail-drawer-customization')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
  });

  it('does not show the "View" row action (replaced by row click)', async () => {
    call.mockImplementation((method: string) => {
      if (method === 'skill.list') return Promise.resolve(ok([pluginSkill]));
      return Promise.resolve(ok(undefined));
    });
    renderScreen();
    await screen.findByTestId('entity-grid-card-skill-plugin/b');
    expect(screen.queryByRole('button', { name: 'View' })).not.toBeInTheDocument();
  });

  it('closes the drawer and opens the editor when Edit is clicked inside the drawer for a workspace item', async () => {
    call.mockImplementation((method: string) => {
      if (method === 'skill.list') return Promise.resolve(ok([workspaceSkill]));
      return Promise.resolve(ok(undefined));
    });
    const user = userEvent.setup();
    renderScreen();

    const card = await screen.findByTestId('entity-grid-card-skill-workspace/a');
    await user.click(card);
    const drawer = await screen.findByTestId('detail-drawer-customization');

    // Use within() to scope to the drawer (the row also has an Edit button)
    await user.click(within(drawer).getByRole('button', { name: /edit/i }));

    expect(screen.queryByTestId('detail-drawer-customization')).not.toBeInTheDocument();
    // The editor is an early-return, so the list container is gone
    expect(screen.queryByTestId('entity-list-skill')).not.toBeInTheDocument();
  });
});
