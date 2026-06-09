import type { ReactNode } from 'react';

export type ViewMode = 'card' | 'table';

export interface FieldDef<T> {
  key: string;
  label: string;
  primary?: boolean;
  secondary?: boolean;
  badge?: boolean;
  width?: number | string;
  align?: 'left' | 'right' | 'center';
  hideInCard?: boolean;
  hideInTable?: boolean;
  searchable?: boolean;
  render?: (item: T, view: ViewMode) => ReactNode;
}

export interface EntityDef<T> {
  name: string;
  pluralName?: string;
  fields: FieldDef<T>[];
  getKey: (item: T) => string;
  defaultView?: ViewMode;
}

export interface RowAction<T> {
  label: string;
  icon?: ReactNode;
  variant?: 'default' | 'destructive';
  onClick: (item: T) => void;
  hidden?: (item: T) => boolean;
  disabled?: (item: T) => boolean;
}

export interface CardSlots<T> {
  header?: (item: T) => ReactNode;
  footer?: (item: T) => ReactNode;
  topBanner?: (item: T) => ReactNode;
}

export interface EntityDataGridProps<T> {
  entity: EntityDef<T>;
  data: T[] | undefined;
  isLoading?: boolean;
  error?: unknown;
  actions?: RowAction<T>[];
  toolbarActions?: ReactNode;
  cardSlots?: CardSlots<T>;
  pageSize?: number;
  searchPlaceholder?: string;
  emptyState?: ReactNode;
  onRowClick?: (item: T) => void;
  /** Visually de-emphasizes a row/card (reduced opacity) — e.g. disabled items. */
  isDimmed?: (item: T) => boolean;
}
