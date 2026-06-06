import {
  Box,
  Card,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import type { CardSlots, EntityDef, RowAction } from './types.js';
import { getFieldValue, renderFieldValue } from './utils.js';

interface CardViewProps<T> {
  entity: EntityDef<T>;
  items: T[];
  actions?: RowAction<T>[] | undefined;
  cardSlots?: CardSlots<T> | undefined;
  onRowClick?: ((item: T) => void) | undefined;
}

export function CardView<T>({
  entity,
  items,
  actions,
  cardSlots,
  onRowClick,
}: CardViewProps<T>): React.ReactElement {
  const visibleFields = entity.fields.filter((f) => !f.hideInCard);
  const primary = visibleFields.find((f) => f.primary);
  const secondary = visibleFields.find((f) => f.secondary);
  const badges = visibleFields.filter((f) => f.badge);
  const others = visibleFields.filter(
    (f) => !f.primary && !f.secondary && !f.badge,
  );

  return (
    <Stack
      spacing={1}
      data-testid={`entity-grid-cards-${entity.name}`}
    >
      {items.map((item) => {
        const banner = cardSlots?.topBanner?.(item);
        const footer = cardSlots?.footer?.(item);
        return (
          <Card
            key={entity.getKey(item)}
            variant="outlined"
            sx={(theme) => ({
              cursor: onRowClick ? 'pointer' : 'default',
              transition: 'box-shadow 120ms',
              '&:hover': { boxShadow: theme.ogs.shadow.sm },
            })}
            onClick={onRowClick ? () => onRowClick(item) : undefined}
            data-testid={`entity-grid-card-${entity.name}-${entity.getKey(item)}`}
          >
            {banner}
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              sx={{
                px: 1.5,
                py: 1,
                alignItems: { sm: 'center' },
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                {cardSlots?.header?.(item)}
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: 'center', flexWrap: 'wrap' }}
                >
                  {primary && (
                    <Typography
                      variant="body2"
                      component="div"
                      sx={{
                        fontWeight: 600,
                        wordBreak: 'break-word',
                      }}
                    >
                      {renderFieldValue(primary, item, 'card') as React.ReactNode}
                    </Typography>
                  )}
                  {badges.map((field) => {
                    const value = renderFieldValue(field, item, 'card');
                    if (value === null || value === undefined || value === '')
                      return null;
                    return (
                      <Chip
                        key={field.key}
                        size="small"
                        variant="outlined"
                        label={value as React.ReactNode}
                        sx={{ height: 20, fontSize: 11 }}
                      />
                    );
                  })}
                </Stack>
                {secondary && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      display: '-webkit-box',
                      WebkitLineClamp: 1,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      mt: 0.25,
                    }}
                  >
                    {renderFieldValue(secondary, item, 'card') as React.ReactNode}
                  </Typography>
                )}
                {others.length > 0 && (
                  <Stack
                    direction="row"
                    spacing={1.5}
                    sx={{ mt: 0.25, flexWrap: 'wrap' }}
                  >
                    {others.map((field) => {
                      const value = renderFieldValue(field, item, 'card');
                      if (value === null || value === undefined || value === '')
                        return null;
                      return (
                        <Typography
                          key={field.key}
                          variant="caption"
                          color="text.secondary"
                        >
                          <strong>{field.label}:</strong>{' '}
                          {value as React.ReactNode}
                        </Typography>
                      );
                    })}
                  </Stack>
                )}
              </Box>
              {(footer || (actions && actions.length > 0)) && (
                <Stack
                  direction="row"
                  spacing={0.5}
                  sx={{ alignItems: 'center', flexShrink: 0 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {footer}
                  {actions
                    ?.filter((a) => !a.hidden?.(item))
                    .map((action) => (
                      <Tooltip key={action.label} title={action.label}>
                        <span>
                          <IconButton
                            size="small"
                            color={
                              action.variant === 'destructive'
                                ? 'error'
                                : 'default'
                            }
                            disabled={action.disabled?.(item)}
                            onClick={(e) => {
                              e.stopPropagation();
                              action.onClick(item);
                            }}
                            aria-label={action.label}
                          >
                            {action.icon}
                          </IconButton>
                        </span>
                      </Tooltip>
                    ))}
                </Stack>
              )}
            </Stack>
          </Card>
        );
      })}
    </Stack>
  );
}

// Re-export to keep imports tidy if other modules want to introspect
export { getFieldValue };
