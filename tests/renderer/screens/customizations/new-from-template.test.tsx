import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomizationList } from '../../../../src/renderer/screens/customizations/CustomizationList.js';
import { mockApi, ok, type CallSpy } from '../../test-utils.js';
import type { Template } from '../../../../src/shared/template.js';

const skillTemplate: Template = {
  id: 'template/new-skill',
  frontmatter: {
    name: 'new-skill',
    targetType: 'skill',
    description: 'starter description',
    scopes: ['personal'],
    version: '0.1.0',
    createdAt: '2026-05-04T00:00:00.000Z',
    updatedAt: '2026-05-04T00:00:00.000Z',
  },
  body: '# Skill body\n',
};

let call: CallSpy;

beforeEach(() => {
  call = mockApi();
});

describe('<CustomizationList> — new from template', () => {
  beforeEach(() => {
    call.mockImplementation((method: string) => {
      if (method === 'customization.list') return Promise.resolve(ok([]));
      if (method === 'template.list') return Promise.resolve(ok([skillTemplate]));
      return Promise.resolve(ok(undefined));
    });
  });

  it('clicking "New from template" opens dialog with templates from template.list', async () => {
    const user = userEvent.setup();
    render(<CustomizationList />);

    await user.click(
      await screen.findByRole('button', { name: /new from template/i }),
    );

    await waitFor(() =>
      expect(call).toHaveBeenCalledWith('template.list', { targetType: 'skill' }),
    );
    expect(await screen.findByText(/new-skill/)).toBeInTheDocument();
  });

  it('selecting a template opens the editor with frontmatter populated from the template', async () => {
    const user = userEvent.setup();
    render(<CustomizationList />);

    await user.click(
      await screen.findByRole('button', { name: /new from template/i }),
    );
    await user.click(await screen.findByRole('button', { name: /new-skill/i }));

    expect(await screen.findByTestId('customization-editor')).toBeInTheDocument();
    expect(screen.getByDisplayValue('new-skill')).toBeInTheDocument();
    expect(screen.getByDisplayValue('starter description')).toBeInTheDocument();
  });
});
