import { Box } from '@mui/material';
import { Kicker } from '../ds/Kicker.js';

/** Slim global footer carrying the OGS brand line (moved out of the TopNav). */
export function AppFooter(): React.ReactElement {
  return (
    <Box
      component="footer"
      data-testid="app-footer"
      sx={(theme) => ({
        flexShrink: 0,
        borderTop: `1px solid ${theme.palette.divider}`,
        bgcolor: 'background.paper',
        px: 3,
        py: 1,
        display: 'flex',
        alignItems: 'center',
      })}
    >
      <Kicker>OGS · TECNOLOGIA BRASIL</Kicker>
    </Box>
  );
}
