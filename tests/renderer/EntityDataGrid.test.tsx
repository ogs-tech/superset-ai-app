import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EntityDataGrid } from '../../src/renderer/components/EntityDataGrid/index.js';
import type {
  EntityDef,
  RowAction,
} from '../../src/renderer/components/EntityDataGrid/index.js';

interface Item {
  id: string;
  name: string;
  description: string;
  category: string;
}

const items: Item[] = [
  { id: '1', name: 'Alpha', description: 'first item', category: 'A' },
  { id: '2', name: 'Bravo', description: 'second item', category: 'B' },
  { id: '3', name: 'Charlie', description: 'third item', category: 'A' },
];

const entity: EntityDef<Item> = {
  name: 'thing',
  pluralName: 'things',
  getKey: (i) => i.id,
  fields: [
    { key: 'name', label: 'Name', primary: true, searchable: true },
    {
      key: 'category',
      label: 'Category',
      badge: true,
      searchable: true,
    },
    {
      key: 'description',
      label: 'Description',
      secondary: true,
      searchable: true,
    },
  ],
};

beforeEach(() => {
  window.localStorage.clear();
});

describe('<EntityDataGrid>', () => {
  it('renders cards by default with all items', () => {
    render(<EntityDataGrid<Item> entity={entity} data={items} />);
    const grid = screen.getByTestId('entity-grid-cards-thing');
    expect(within(grid).getAllByText(/Alpha|Bravo|Charlie/)).toHaveLength(3);
  });

  it('switches to table view when toggle clicked and persists', () => {
    const { rerender } = render(
      <EntityDataGrid<Item> entity={entity} data={items} />,
    );
    fireEvent.click(screen.getByTestId('entity-grid-view-table-thing'));
    expect(screen.getByTestId('entity-grid-table-thing')).toBeInTheDocument();
    expect(window.localStorage.getItem('entity-grid:thing:view')).toBe('table');

    // re-render simulates remount — should restore from localStorage
    rerender(<EntityDataGrid<Item> entity={entity} data={items} />);
    expect(screen.getByTestId('entity-grid-table-thing')).toBeInTheDocument();
  });

  it('filters items by searchable fields', async () => {
    const user = userEvent.setup();
    render(<EntityDataGrid<Item> entity={entity} data={items} />);
    await user.type(screen.getByTestId('entity-grid-search-thing'), 'second');
    const grid = screen.getByTestId('entity-grid-cards-thing');
    expect(within(grid).queryByText('Alpha')).not.toBeInTheDocument();
    expect(within(grid).getByText('Bravo')).toBeInTheDocument();
    expect(within(grid).queryByText('Charlie')).not.toBeInTheDocument();
  });

  it('shows "no matches" empty state when search returns nothing', async () => {
    const user = userEvent.setup();
    render(<EntityDataGrid<Item> entity={entity} data={items} />);
    await user.type(screen.getByTestId('entity-grid-search-thing'), 'zzz');
    expect(screen.getByText(/No things match your search/)).toBeInTheDocument();
  });

  it('paginates when items exceed pageSize', () => {
    const many: Item[] = Array.from({ length: 5 }, (_, i) => ({
      id: String(i),
      name: `Item ${i}`,
      description: `desc ${i}`,
      category: 'X',
    }));
    render(
      <EntityDataGrid<Item> entity={entity} data={many} pageSize={2} />,
    );
    const grid = screen.getByTestId('entity-grid-cards-thing');
    expect(within(grid).getAllByText(/Item \d/)).toHaveLength(2);
    expect(
      screen.getByTestId('entity-grid-pagination-thing'),
    ).toBeInTheDocument();
  });

  it('invokes row action with the correct item', async () => {
    const user = userEvent.setup();
    const clicked: Item[] = [];
    const actions: RowAction<Item>[] = [
      {
        label: 'Inspect',
        icon: <span data-testid="inspect-icon">i</span>,
        onClick: (item) => clicked.push(item),
      },
    ];
    render(
      <EntityDataGrid<Item>
        entity={entity}
        data={items}
        actions={actions}
      />,
    );
    const bravoCard = screen.getByTestId('entity-grid-card-thing-2');
    await user.click(within(bravoCard).getByRole('button', { name: 'Inspect' }));
    expect(clicked).toHaveLength(1);
    expect(clicked[0]?.name).toBe('Bravo');
  });

  it('renders the empty state fallback when data is empty and no search', () => {
    render(
      <EntityDataGrid<Item>
        entity={entity}
        data={[]}
        emptyState={<div data-testid="custom-empty">nothing here</div>}
      />,
    );
    expect(screen.getByTestId('custom-empty')).toBeInTheDocument();
  });
});
