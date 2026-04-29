import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ArtifactList } from '../../../../src/renderer/screens/artifacts/ArtifactList.js';
import { mockApi, ok, type CallSpy } from '../../test-utils.js';
import type { Template } from '../../../../src/shared/artifact.js';

const skillTemplate: Template = {
  id: 'skill/default',
  type: 'skill',
  name: 'Default Skill',
  description: 'starter skill template',
  frontmatter: {
    type: 'skill',
    name: 'New Skill',
    description: 'starter description',
    scopes: ['personal'],
    version: '0.1.0',
  },
  body: '# Skill body\n',
};

let call: CallSpy;

beforeEach(() => {
  call = mockApi();
});

describe('<ArtifactList> — new from template', () => {
  beforeEach(() => {
    call.mockImplementation((method: string) => {
      if (method === 'artifact.list') return Promise.resolve(ok([]));
      if (method === 'template.list') return Promise.resolve(ok([skillTemplate]));
      return Promise.resolve(ok(undefined));
    });
  });

  it('clicking "Novo a partir de template" opens dialog with templates from template.list', async () => {
    const user = userEvent.setup();
    render(<ArtifactList />);

    await user.click(
      await screen.findByRole('button', { name: /novo a partir de template/i }),
    );

    await waitFor(() =>
      expect(call).toHaveBeenCalledWith('template.list', { type: 'skill' }),
    );
    expect(await screen.findByText(/Default Skill/)).toBeInTheDocument();
  });

  it('selecting a template opens the editor with frontmatter populated from the template', async () => {
    const user = userEvent.setup();
    render(<ArtifactList />);

    await user.click(
      await screen.findByRole('button', { name: /novo a partir de template/i }),
    );
    await user.click(await screen.findByRole('button', { name: /Default Skill/i }));

    expect(await screen.findByTestId('artifact-editor')).toBeInTheDocument();
    expect(screen.getByDisplayValue('New Skill')).toBeInTheDocument();
    expect(screen.getByDisplayValue('starter description')).toBeInTheDocument();
  });
});
