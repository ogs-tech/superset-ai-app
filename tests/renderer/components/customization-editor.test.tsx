import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomizationEditor } from '../../../src/renderer/components/CustomizationEditor.js';
import { mockApi, ok, fail, renderWithTheme, type CallSpy } from '../test-utils.js';
import { WORKSPACE_SOURCE, type Skill } from '../../../src/shared/entity.js';

const baseCustomization = (): Skill => ({
  urn: 'urn:skill:foo',
  kind: 'skill',
  name: 'foo',
  description: 'sample',
  scopes: ['personal'],
  metadata: { version: '0.1.0', createdAt: '', updatedAt: '' },
  source: WORKSPACE_SOURCE,
  content: '# Title\n\nSome **markdown** body.',
});

let call: CallSpy;

beforeEach(() => {
  call = mockApi();
});

describe('<CustomizationEditor>', () => {
  it('renders a textarea for the body', () => {
    renderWithTheme(
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
    renderWithTheme(
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
        skill: { ...initial },
        syncReport: [],
      }),
    );

    renderWithTheme(
      <CustomizationEditor
        initial={initial}
        isCreate={true}
        onSaved={onSaved}
        onCancel={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() =>
      expect(call).toHaveBeenCalledWith(
        'skill.save',
        expect.objectContaining({ isCreate: true }),
      ),
    );

    expect(await screen.findByTestId('toast')).toHaveAttribute('data-variant', 'success');
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('renders two checkboxes (personal, project) reflecting scopes', () => {
    const initial = baseCustomization();
    initial.scopes = ['personal', 'project'];
    renderWithTheme(
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

  it('toggling a checkbox updates scopes sent on save', async () => {
    const user = userEvent.setup();
    const initial = baseCustomization();
    call.mockResolvedValue(
      ok({
        skill: { ...initial, scopes: ['personal', 'project'] },
        syncReport: [],
      }),
    );

    renderWithTheme(
      <CustomizationEditor
        initial={initial}
        isCreate={true}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('checkbox', { name: /project/i }));
    await user.click(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() =>
      expect(call).toHaveBeenCalledWith(
        'skill.save',
        expect.objectContaining({
          skill: expect.objectContaining({ scopes: ['personal', 'project'] }),
        }),
      ),
    );
  });

  it('unchecking the only selected scope leaves scopes empty (validation handled by service)', async () => {
    const user = userEvent.setup();
    const initial = baseCustomization();

    renderWithTheme(
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

    renderWithTheme(
      <CustomizationEditor
        initial={baseCustomization()}
        isCreate={true}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /salvar/i }));

    const toast = await screen.findByTestId('toast');
    expect(toast).toHaveAttribute('data-variant', 'error');
    expect(toast).toHaveTextContent(/slug inválido/);
  });
});
