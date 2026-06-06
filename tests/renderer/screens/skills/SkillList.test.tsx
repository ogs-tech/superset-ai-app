import { describe, it, expect, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SkillList } from '../../../../src/renderer/screens/skills/SkillList.js';
import {
  mockApi,
  ok,
  renderWithQuery,
  type CallSpy,
} from '../../test-utils.js';

let call: CallSpy;

const FROZEN = '2026-04-26T10:00:00.000Z';

const skill = (
  name: string,
  source: { kind: 'workspace' } | { kind: 'plugin'; pluginId: string },
) => ({
  id: name,
  frontmatter: {
    name,
    type: 'skill',
    description: `${name} skill`,
    scopes: ['personal'],
    version: '1.0.0',
    createdAt: FROZEN,
    updatedAt: FROZEN,
  },
  body: 'body',
  source,
});

const cardId = (
  name: string,
  source: { kind: 'workspace' } | { kind: 'plugin'; pluginId: string },
): string => `entity-grid-card-skill-${source.kind}/${name}`;

beforeEach(() => {
  window.localStorage.clear();
  call = mockApi();
});

describe('<SkillList>', () => {
  it('renders empty state when no skills', async () => {
    call.mockImplementation((method: string) => {
      if (method === 'skill.list') return Promise.resolve(ok([]));
      return Promise.resolve(ok(undefined));
    });
    renderWithQuery(<SkillList />);
    expect(await screen.findByText(/Nenhuma skill ainda/i)).toBeInTheDocument();
  });

  it('shows plugin badge for plugin-sourced skills', async () => {
    call.mockImplementation((method: string) => {
      if (method === 'skill.list')
        return Promise.resolve(
          ok([
            skill('local', { kind: 'workspace' }),
            skill('from-plugin', { kind: 'plugin', pluginId: 'superpowers' }),
          ]),
        );
      return Promise.resolve(ok(undefined));
    });
    renderWithQuery(<SkillList />);

    expect(
      await screen.findByTestId(cardId('local', { kind: 'workspace' })),
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId(
        cardId('from-plugin', { kind: 'plugin', pluginId: 'superpowers' }),
      ),
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId('plugin-origin-badge-superpowers'),
    ).toBeInTheDocument();
  });

  it('renders plugin origin as a dedicated column in table view', async () => {
    const user = userEvent.setup();
    call.mockImplementation((method: string) => {
      if (method === 'skill.list')
        return Promise.resolve(
          ok([
            skill('local', { kind: 'workspace' }),
            skill('from-plugin', { kind: 'plugin', pluginId: 'superpowers' }),
          ]),
        );
      return Promise.resolve(ok(undefined));
    });
    renderWithQuery(<SkillList />);

    await user.click(await screen.findByTestId('entity-grid-view-table-skill'));
    const table = await screen.findByTestId('entity-grid-table-skill');

    // Dedicated "Plugin" column, with the badge living in that column.
    expect(within(table).getByText('Plugin')).toBeInTheDocument();
    expect(
      await within(table).findByTestId('plugin-origin-badge-superpowers'),
    ).toBeInTheDocument();

    // Workspace rows show no plugin badge inline next to the name.
    const localRow = within(table).getByTestId(
      'entity-grid-row-skill-workspace/local',
    );
    expect(
      within(localRow).queryByTestId('plugin-origin-badge-superpowers'),
    ).not.toBeInTheDocument();
  });

  it('hides all row action buttons for plugin-sourced skills', async () => {
    call.mockImplementation((method: string) => {
      if (method === 'skill.list')
        return Promise.resolve(
          ok([skill('from-plugin', { kind: 'plugin', pluginId: 'p' })]),
        );
      return Promise.resolve(ok(undefined));
    });
    renderWithQuery(<SkillList />);

    const card = await screen.findByTestId(
      cardId('from-plugin', { kind: 'plugin', pluginId: 'p' }),
    );
    expect(within(card).queryByRole('button', { name: 'View' })).toBeNull();
    expect(within(card).queryByRole('button', { name: 'Editar' })).toBeNull();
    expect(within(card).queryByRole('button', { name: 'Excluir' })).toBeNull();
  });

  it('shows edit/delete buttons for workspace skills', async () => {
    call.mockImplementation((method: string) => {
      if (method === 'skill.list')
        return Promise.resolve(ok([skill('local', { kind: 'workspace' })]));
      return Promise.resolve(ok(undefined));
    });
    renderWithQuery(<SkillList />);

    const card = await screen.findByTestId(
      cardId('local', { kind: 'workspace' }),
    );
    expect(
      within(card).getByRole('button', { name: 'Editar' }),
    ).toBeInTheDocument();
    expect(
      within(card).getByRole('button', { name: 'Duplicar' }),
    ).toBeInTheDocument();
    expect(
      within(card).getByRole('button', { name: 'Excluir' }),
    ).toBeInTheDocument();
  });
});
