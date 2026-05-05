import {
  Box,
  Button,
  Container,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ReactMarkdown from 'react-markdown';
import { ReadOnlyNotice } from './ReadOnlyNotice.js';

interface EntityViewerProps {
  entity: {
    frontmatter: { name: string; description?: string } & Record<string, unknown>;
    body: string;
    source: { kind: 'workspace' } | { kind: 'plugin'; pluginId: string };
  };
  title: string;
  onBack: () => void;
}

export function EntityViewer({ entity, title, onBack }: EntityViewerProps): React.ReactElement {
  const isPlugin = entity.source.kind === 'plugin';
  const pluginId = isPlugin && entity.source.kind === 'plugin' ? entity.source.pluginId : null;

  return (
    <Container
      component="main"
      data-testid="entity-viewer"
      maxWidth="md"
      sx={{ py: 4 }}
    >
      <Stack
        direction="row"
        sx={{ mb: 3, justifyContent: 'space-between', alignItems: 'center' }}
      >
        <Typography variant="h4" component="h1">
          {title}: {entity.frontmatter.name}
        </Typography>
        <Button variant="text" startIcon={<ArrowBackIcon />} onClick={onBack}>
          Back
        </Button>
      </Stack>

      {pluginId && <ReadOnlyNotice pluginId={pluginId} />}

      <Paper variant="outlined" sx={{ p: 3, mb: 2 }}>
        <Typography variant="caption" color="text.secondary">
          Description
        </Typography>
        <Typography variant="body1" sx={{ mb: 2 }}>
          {typeof entity.frontmatter.description === 'string'
            ? entity.frontmatter.description
            : '—'}
        </Typography>
      </Paper>

      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="caption" color="text.secondary">
          Body
        </Typography>
        <Box sx={{ mt: 1 }}>
          <ReactMarkdown>{entity.body}</ReactMarkdown>
        </Box>
      </Paper>
    </Container>
  );
}
