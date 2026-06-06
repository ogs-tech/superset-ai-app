import { Typography, type TypographyProps } from '@mui/material';
import type { ReactNode } from 'react';

interface KickerProps {
  children: ReactNode;
  component?: TypographyProps['component'];
}

export function Kicker({ children, component = 'span' }: KickerProps): React.ReactElement {
  return (
    <Typography
      component={component}
      sx={(theme) => ({
        fontFamily: theme.ogs.fonts.mono,
        fontSize: '0.6875rem',
        fontWeight: 500,
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        color: theme.ogs.slate,
        lineHeight: 1.4,
      })}
    >
      {children}
    </Typography>
  );
}
