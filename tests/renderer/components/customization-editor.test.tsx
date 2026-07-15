import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomizationEditor } from '../../../src/renderer/components/CustomizationEditor.js';
import { mockApi, ok, fail, renderWithTheme, type CallSpy } from '../test-utils.js';
import { WORKSPACE_SOURCE, type PersonalInstruction, type Skill } from '../../../src/shared/entity.js';

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

const basePersonalInstruction = (): PersonalInstruction => ({
  urn: 'urn:instruction:default',
  kind: 'instruction',
  name: 'default',
  description: 'ignored on save (frontmatter-free storage)',
  scopes: ['personal'],
  metadata: { version: '0.1.0', createdAt: '', updatedAt: '' },
  source: WORKSPACE_SOURCE,
  content: '# Personal profile\n',
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

  it('renders the personal scope checkbox reflecting scopes (project temporarily hidden for skill)', () => {
    const initial = baseCustomization();
    initial.scopes = ['personal'];
    renderWithTheme(
      <CustomizationEditor
        initial={initial}
        isCreate={false}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const personal = screen.getByRole('checkbox', { name: /personal/i });
    expect(personal).toBeChecked();
    expect(screen.queryByRole('checkbox', { name: /project/i })).toBeNull();
  });

  it('toggling the personal checkbox off leaves scopes empty on save', async () => {
    const user = userEvent.setup();
    const initial = baseCustomization();
    call.mockResolvedValue(
      ok({
        skill: { ...initial, scopes: [] },
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

    await user.click(screen.getByRole('checkbox', { name: /personal/i }));
    await user.click(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() =>
      expect(call).toHaveBeenCalledWith(
        'skill.save',
        expect.objectContaining({
          skill: expect.objectContaining({ scopes: [] }),
        }),
      ),
    );
  });

  it('editing the name in edit mode still sends the original urn (so the service detects a rename)', async () => {
    const user = userEvent.setup();
    const initial = baseCustomization(); // urn 'urn:skill:foo', name 'foo'
    call.mockResolvedValue(ok({ skill: { ...initial, name: 'bar' }, syncReport: [] }));

    renderWithTheme(
      <CustomizationEditor
        initial={initial}
        isCreate={false}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const nameField = screen.getByLabelText('Name');
    await user.clear(nameField);
    await user.type(nameField, 'bar');
    await user.click(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() =>
      expect(call).toHaveBeenCalledWith(
        'skill.save',
        expect.objectContaining({
          skill: expect.objectContaining({ urn: 'urn:skill:foo', name: 'bar' }),
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
  });

  // TODO(follow-up): remove when skill/agent regain a per-entity repoPath and
  // 'project' scope is unblocked in the schema.
  it('does not render the project scope toggle for skill/agent (temporary block)', () => {
    renderWithTheme(
      <CustomizationEditor
        initial={baseCustomization()}
        isCreate={true}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByRole('checkbox', { name: /project/i })).toBeNull();
  });

  // Personal instruction: name/scope are fixed AND description/version aren't
  // persisted (frontmatter-free storage). Hiding all four fields must fully
  // suppress the Frontmatter panel — otherwise the user sees empty widgets that
  // do nothing on save.
  it('hides the entire Frontmatter section when all frontmatter fields are hidden', () => {
    renderWithTheme(
      <CustomizationEditor
        initial={basePersonalInstruction()}
        isCreate={false}
        hiddenFields={new Set(['name', 'scope', 'description', 'version'])}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText('Description')).toBeNull();
    expect(screen.queryByLabelText('Version')).toBeNull();
    expect(screen.queryByLabelText('Name')).toBeNull();
    // No scope checkboxes either.
    expect(screen.queryByRole('checkbox', { name: /personal/i })).toBeNull();
    // Body panel must still be there.
    expect(screen.getByTestId('body-textarea')).toBeInTheDocument();
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
