import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomizationEditor } from '../../../../src/renderer/screens/customizations/CustomizationEditor.js';
import { mockApi, ok, fail, type CallSpy } from '../../test-utils.js';
import type { Customization } from '../../../../src/shared/customization.js';
import type { Template } from '../../../../src/shared/template.js';

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

  it('clicking Save dispatches customization.save and shows success toast on ok envelope', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const initial = baseCustomization();
    call.mockResolvedValue(
      ok({ customization: { ...initial, id: 'skill/foo' }, syncReport: [] }),
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
        'customization.save',
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
      ok({ customization: { ...initial, id: 'skill/foo' }, syncReport: [] }),
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
        'customization.save',
        expect.objectContaining({
          customization: expect.objectContaining({
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

  describe('apply template', () => {
    const skillTemplate: Template = {
      id: 'template/default-skill',
      frontmatter: {
        name: 'default-skill',
        targetType: 'skill',
        description: 'starter skill template',
        scopes: ['project'],
        version: '9.9.9',
        createdAt: '2026-05-04T00:00:00.000Z',
        updatedAt: '2026-05-04T00:00:00.000Z',
      },
      body: '# Template body\n',
    };

    it('shows "Apply template" for non-template customizations and lists templates by current type', async () => {
      const user = userEvent.setup();
      call.mockImplementation((method: string) => {
        if (method === 'template.list') return Promise.resolve(ok([skillTemplate]));
        return Promise.resolve(ok(undefined));
      });

      render(
        <CustomizationEditor
          initial={baseCustomization()}
          isCreate={false}
          onSaved={vi.fn()}
          onCancel={vi.fn()}
        />,
      );

      await user.click(screen.getByRole('button', { name: /apply template/i }));

      await waitFor(() =>
        expect(call).toHaveBeenCalledWith('template.list', { targetType: 'skill' }),
      );
      expect(await screen.findByText(/default-skill/)).toBeInTheDocument();
    });

    it('replaces only the body and preserves frontmatter after confirmation', async () => {
      const user = userEvent.setup();
      call.mockImplementation((method: string) => {
        if (method === 'template.list') return Promise.resolve(ok([skillTemplate]));
        return Promise.resolve(ok(undefined));
      });

      render(
        <CustomizationEditor
          initial={baseCustomization()}
          isCreate={false}
          onSaved={vi.fn()}
          onCancel={vi.fn()}
        />,
      );

      await user.click(screen.getByRole('button', { name: /apply template/i }));
      await user.click(await screen.findByRole('button', { name: /default-skill/i }));
      await user.click(
        await screen.findByRole('button', { name: /replace body/i }),
      );
      await waitFor(() =>
        expect(screen.queryByTestId('confirm-apply-template-dialog')).not.toBeInTheDocument(),
      );

      expect(screen.getByTestId('body-textarea')).toHaveValue('# Template body\n');
      // frontmatter preserved
      expect(screen.getByDisplayValue('foo')).toBeInTheDocument();
      expect(screen.getByDisplayValue('sample')).toBeInTheDocument();
      expect(screen.getByDisplayValue('0.1.0')).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /personal/i })).toBeChecked();
      expect(screen.getByRole('checkbox', { name: /project/i })).not.toBeChecked();
    });

    it('cancelling the confirmation keeps the original body', async () => {
      const user = userEvent.setup();
      call.mockImplementation((method: string) => {
        if (method === 'template.list') return Promise.resolve(ok([skillTemplate]));
        return Promise.resolve(ok(undefined));
      });

      render(
        <CustomizationEditor
          initial={baseCustomization()}
          isCreate={false}
          onSaved={vi.fn()}
          onCancel={vi.fn()}
        />,
      );

      await user.click(screen.getByRole('button', { name: /apply template/i }));
      await user.click(await screen.findByRole('button', { name: /default-skill/i }));
      await user.click(
        await screen.findByRole('button', { name: /keep current body/i }),
      );

      expect(screen.getByTestId('body-textarea')).toHaveValue(baseCustomization().body);
    });

    it('skips confirmation when the body is empty', async () => {
      const user = userEvent.setup();
      call.mockImplementation((method: string) => {
        if (method === 'template.list') return Promise.resolve(ok([skillTemplate]));
        return Promise.resolve(ok(undefined));
      });

      const initial = baseCustomization();
      initial.body = '';

      render(
        <CustomizationEditor
          initial={initial}
          isCreate={true}
          onSaved={vi.fn()}
          onCancel={vi.fn()}
        />,
      );

      await user.click(screen.getByRole('button', { name: /apply template/i }));
      await user.click(await screen.findByRole('button', { name: /default-skill/i }));

      expect(
        screen.queryByRole('button', { name: /replace body/i }),
      ).not.toBeInTheDocument();
      expect(screen.getByTestId('body-textarea')).toHaveValue('# Template body\n');
    });
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
