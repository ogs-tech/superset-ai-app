import { describe, it, expect, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PluginRelatedEntities } from '../../../src/renderer/components/PluginRelatedEntities.js';
import { mockApi, ok, renderWithQuery, type CallSpy } from '../test-utils.js';

const skill = (id: string, pluginId: string | null) => ({
  id,
  frontmatter: { name: id, description: `${id} desc` },
  body: `# ${id}`,
  source: pluginId
    ? { kind: 'plugin' as const, pluginId }
    : { kind: 'workspace' as const },
});

let call: CallSpy;

beforeEach(() => {
  call = mockApi();
});

describe('<PluginRelatedEntities>', () => {
  it('groups skills/agents/commands and shows only those matching pluginId', async () => {
    call.mockImplementation((method: string) => {
      if (method === 'skill.list')
        return Promise.resolve(
          ok([
            skill('mine-skill', 'my-plugin'),
            skill('other-skill', 'other-plugin'),
            skill('workspace-skill', null),
          ]),
        );
      if (method === 'agent.list')
        return Promise.resolve(ok([skill('mine-agent', 'my-plugin')]));
      if (method === 'command.list')
        return Promise.resolve(ok([skill('mine-cmd', 'my-plugin')]));
      return Promise.resolve(ok(undefined));
    });

    renderWithQuery(<PluginRelatedEntities pluginId="my-plugin" />);

    const skillsGroup = await screen.findByTestId(
      'plugin-related-group-skills',
    );
    expect(within(skillsGroup).getByText('mine-skill')).toBeInTheDocument();
    expect(within(skillsGroup).queryByText('other-skill')).not.toBeInTheDocument();
    expect(
      within(skillsGroup).queryByText('workspace-skill'),
    ).not.toBeInTheDocument();

    const agentsGroup = screen.getByTestId('plugin-related-group-agents');
    expect(within(agentsGroup).getByText('mine-agent')).toBeInTheDocument();

    const commandsGroup = screen.getByTestId('plugin-related-group-commands');
    expect(within(commandsGroup).getByText('mine-cmd')).toBeInTheDocument();
  });

  it('shows empty state when plugin has no related entities', async () => {
    call.mockImplementation((method: string) => {
      if (method === 'skill.list') return Promise.resolve(ok([]));
      if (method === 'agent.list') return Promise.resolve(ok([]));
      if (method === 'command.list') return Promise.resolve(ok([]));
      return Promise.resolve(ok(undefined));
    });
    renderWithQuery(<PluginRelatedEntities pluginId="my-plugin" />);
    expect(
      await screen.findByText(/no related entities/i),
    ).toBeInTheDocument();
  });

  it('queries the IPC with the provided scope', async () => {
    call.mockImplementation((method: string) => {
      if (method === 'skill.list') return Promise.resolve(ok([]));
      if (method === 'agent.list') return Promise.resolve(ok([]));
      if (method === 'command.list') return Promise.resolve(ok([]));
      return Promise.resolve(ok(undefined));
    });
    renderWithQuery(
      <PluginRelatedEntities pluginId="my-plugin" scope="project" />,
    );
    await screen.findByText(/no related entities/i);
    const skillCall = call.mock.calls.find(([m]) => m === 'skill.list');
    expect(skillCall?.[1]).toEqual({ scope: 'project' });
  });

  it('clicking a related skill opens the customization view drawer', async () => {
    call.mockImplementation((method: string) => {
      if (method === 'skill.list')
        return Promise.resolve(ok([skill('mine-skill', 'my-plugin')]));
      if (method === 'agent.list') return Promise.resolve(ok([]));
      if (method === 'command.list') return Promise.resolve(ok([]));
      return Promise.resolve(ok(undefined));
    });
    const user = userEvent.setup();
    renderWithQuery(<PluginRelatedEntities pluginId="my-plugin" />);

    const row = await screen.findByRole('button', { name: /mine-skill/ });
    await user.click(row);

    expect(
      await screen.findByTestId('detail-drawer-customization'),
    ).toBeInTheDocument();
  });
});
