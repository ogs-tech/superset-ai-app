import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomizationEditor } from '../../../src/renderer/components/CustomizationEditor.js';
import { mockApi, ok, fail, type CallSpy } from '../test-utils.js';
import type { Customization } from '../../../src/shared/customization.js';

const baseCustomization = (): Customization => ({
  id: '',
  frontmatter: {
    name: 'foo',
    type: 'skill',
    description: 'sample',
    scopes: ['personal'],
    version: '0.1.0',
    createdAt: '',
    updatedAt: '',
  },
  body: '# Title\n\nSome **markdown** body.',
});

let call: CallSpy;

beforeEach(() => {
  call = mockApi();
});

describe('<CustomizationEditor>', () => {
  it('renders a textarea for the body', () => {
    render(
      <CustomizationEditor
        initial={baseCustomization()}
        isCreate={true}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByTestId('body-textarea')).toBeInTheDocument();
  });

  it('renders the markdown preview via react-markdown', () => {
    render(
      <CustomizationEditor
        initial={baseCustomization()}
        isCreate={true}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const preview = screen.getByTestId('markdown-preview');
    expect(preview.querySelector('h1')?.textContent).toBe('Title');
    expect(preview.querySelector('strong')?.textContent).toBe('markdown');
  });

  it('clicking Save dispatches skill.save (workspace flow) and shows success toast on ok envelope', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const initial = baseCustomization();
    call.mockResolvedValue(
      ok({
        skill: {
          id: 'foo',
          frontmatter: { ...initial.frontmatter },
          source: { kind: 'workspace' },
          body: initial.body,
        },
        syncReport: [],
      }),
    );

    render(
      <CustomizationEditor
        initial={initial}
        isCreate={true}
        onSaved={onSaved}
        onCancel={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() =>
      expect(call).toHaveBeenCalledWith(
        'skill.save',
        expect.objectContaining({ isCreate: true }),
      ),
    );

    expect(await screen.findByTestId('toast')).toHaveAttribute('data-variant', 'success');
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('renders two checkboxes (personal, project) reflecting frontmatter.scopes', () => {
    const initial = baseCustomization();
    initial.frontmatter.scopes = ['personal', 'project'];
    render(
      <CustomizationEditor
        initial={initial}
        isCreate={false}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const personal = screen.getByRole('checkbox', { name: /personal/i });
    const project = screen.getByRole('checkbox', { name: /project/i });
    expect(personal).toBeChecked();
    expect(project).toBeChecked();
  });

  it('toggling a checkbox updates frontmatter.scopes sent on save', async () => {
    const user = userEvent.setup();
    const initial = baseCustomization();
    call.mockResolvedValue(
      ok({
        skill: {
          id: 'foo',
          frontmatter: { ...initial.frontmatter, scopes: ['personal', 'project'] },
          source: { kind: 'workspace' },
          body: initial.body,
        },
        syncReport: [],
      }),
    );

    render(
      <CustomizationEditor
        initial={initial}
        isCreate={true}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('checkbox', { name: /project/i }));
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() =>
      expect(call).toHaveBeenCalledWith(
        'skill.save',
        expect.objectContaining({
          skill: expect.objectContaining({
            frontmatter: expect.objectContaining({ scopes: ['personal', 'project'] }),
          }),
        }),
      ),
    );
  });

  it('unchecking the only selected scope leaves scopes empty (validation handled by service)', async () => {
    const user = userEvent.setup();
    const initial = baseCustomization();

    render(
      <CustomizationEditor
        initial={initial}
        isCreate={true}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('checkbox', { name: /personal/i }));
    expect(screen.getByRole('checkbox', { name: /personal/i })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /project/i })).not.toBeChecked();
  });

  it('shows error toast with the validation message when save fails', async () => {
    const user = userEvent.setup();
    call.mockResolvedValue(fail('validation', 'slug inválido'));

    render(
      <CustomizationEditor
        initial={baseCustomization()}
        isCreate={true}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /save/i }));

    const toast = await screen.findByTestId('toast');
    expect(toast).toHaveAttribute('data-variant', 'error');
    expect(toast).toHaveTextContent(/slug inválido/);
  });
});
