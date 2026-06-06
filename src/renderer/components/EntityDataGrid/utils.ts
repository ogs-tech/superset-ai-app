import type { FieldDef, ViewMode } from './types.js';

export function getFieldValue<T>(item: T, key: string): unknown {
  return key.split('.').reduce<unknown>((acc, part) => {
    if (acc === null || acc === undefined) return undefined;
    if (typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[part];
  }, item);
}

export function renderFieldValue<T>(
  field: FieldDef<T>,
  item: T,
  view: ViewMode,
): unknown {
  if (field.render) return field.render(item, view);
  return getFieldValue(item, field.key);
}

export function filterBySearch<T>(
  items: T[],
  fields: FieldDef<T>[],
  query: string,
): T[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return items;
  const searchable = fields.filter((f) => f.searchable);
  if (searchable.length === 0) return items;
  return items.filter((item) =>
    searchable.some((field) => {
      const value = getFieldValue(item, field.key);
      if (value === null || value === undefined) return false;
      return String(value).toLowerCase().includes(trimmed);
    }),
  );
}

export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export function viewStorageKey(entityName: string): string {
  return `entity-grid:${entityName}:view`;
}
