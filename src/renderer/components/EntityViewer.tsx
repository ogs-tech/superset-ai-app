import {
  Box,
  Button,
  Container,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { ArrowLeft } from 'lucide-react';
import { Icon } from './ds/Icon.js';
import { Kicker } from './ds/Kicker.js';
import { fonts } from '../tokens.js';
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
        <Box>
          <Kicker>{title}</Kicker>
          <Typography
            variant="h4"
            component="h1"
            sx={{ fontFamily: fonts.mono }}
          >
            {entity.frontmatter.name}
          </Typography>
        </Box>
        <Button variant="text" startIcon={<Icon glyph={ArrowLeft} size={16} />} onClick={onBack}>
          Back
        </Button>
      </Stack>

      {pluginId && <ReadOnlyNotice pluginId={pluginId} />}

      <Paper variant="outlined" sx={{ p: 3, mb: 2 }}>
        <Kicker>Description</Kicker>
        <Typography variant="body1" sx={{ mt: 0.5 }}>
          {typeof entity.frontmatter.description === 'string'
            ? entity.frontmatter.description
            : '—'}
        </Typography>
      </Paper>

      <Paper variant="outlined" sx={{ p: 3 }}>
        <Kicker>Body</Kicker>
        <Box sx={{ mt: 1 }}>
          <ReactMarkdown>{entity.body}</ReactMarkdown>
        </Box>
      </Paper>
    </Container>
  );
}
