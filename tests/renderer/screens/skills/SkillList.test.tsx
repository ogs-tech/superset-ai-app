import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SkillList } from '../../../../src/renderer/screens/skills/SkillList.js';
import { mockApi, ok, type CallSpy } from '../../test-utils.js';

let call: CallSpy;

const FROZEN = '2026-04-26T10:00:00.000Z';

const skill = (name: string, source: { kind: 'workspace' } | { kind: 'plugin'; pluginId: string }) => ({
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

beforeEach(() => {
  call = mockApi();
});

describe('<SkillList>', () => {
  it('renders empty state when no skills', async () => {
    call.mockImplementation((method: string) => {
      if (method === 'skill.list') return Promise.resolve(ok([]));
      return Promise.resolve(ok(undefined));
    });
    render(<SkillList />);
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
    render(<SkillList />);

    expect(await screen.findByTestId('skill-item-local')).toBeInTheDocument();
    expect(await screen.findByTestId('skill-item-from-plugin')).toBeInTheDocument();
    expect(
      await screen.findByTestId('plugin-origin-badge-superpowers'),
    ).toBeInTheDocument();
  });

  it('hides edit/delete buttons for plugin-sourced skills', async () => {
    call.mockImplementation((method: string) => {
      if (method === 'skill.list')
        return Promise.resolve(
          ok([skill('from-plugin', { kind: 'plugin', pluginId: 'p' })]),
        );
      return Promise.resolve(ok(undefined));
    });
    render(<SkillList />);

    await screen.findByTestId('skill-item-from-plugin');
    // Plugin-sourced rows show View button instead of Edit/Delete
    const item = screen.getByTestId('skill-item-from-plugin');
    expect(item.querySelector('[aria-label="View"]')).not.toBeNull();
    expect(item.querySelector('[aria-label="Edit"]')).toBeNull();
    expect(item.querySelector('[aria-label="Delete"]')).toBeNull();
  });

  it('shows edit/delete buttons for workspace skills', async () => {
    call.mockImplementation((method: string) => {
      if (method === 'skill.list')
        return Promise.resolve(ok([skill('local', { kind: 'workspace' })]));
      return Promise.resolve(ok(undefined));
    });
    render(<SkillList />);

    await screen.findByTestId('skill-item-local');
    const item = screen.getByTestId('skill-item-local');
    expect(item.querySelector('[aria-label="Edit"]')).not.toBeNull();
    expect(item.querySelector('[aria-label="Duplicate"]')).not.toBeNull();
    expect(item.querySelector('[aria-label="Delete"]')).not.toBeNull();
    expect(item.querySelector('[aria-label="View"]')).toBeNull();
  });
});
