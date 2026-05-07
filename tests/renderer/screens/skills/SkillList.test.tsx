import { describe, it, expect, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
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
  call = mockApi();
});

describe('<SkillList>', () => {
  it('renders empty state when no skills', async () => {
    call.mockImplementation((method: string) => {
      if (method === 'skill.list') return Promise.resolve(ok([]));
      return Promise.resolve(ok(undefined));
    });
    renderWithQuery(<SkillList />);
    expect(await screen.findByText(/No skills yet/i)).toBeInTheDocument();
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
    expect(within(card).queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(within(card).queryByRole('button', { name: 'Delete' })).toBeNull();
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
      within(card).getByRole('button', { name: 'Edit' }),
    ).toBeInTheDocument();
    expect(
      within(card).getByRole('button', { name: 'Duplicate' }),
    ).toBeInTheDocument();
    expect(
      within(card).getByRole('button', { name: 'Delete' }),
    ).toBeInTheDocument();
  });
});
