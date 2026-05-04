import { DomainError } from './errors.js';
import { validateArtifactName } from './artifact-name.js';

const TEMPLATE_PREFIX = 'template';

export interface ParsedTemplateId {
  name: string;
}

export function parseTemplateId(id: string): ParsedTemplateId {
  const slashIndex = id.indexOf('/');
  if (slashIndex === -1) {
    throw new DomainError('validation', `Invalid template id: '${id}' (missing '/')`, {
      invalid: ['id'],
    });
  }
  const prefix = id.slice(0, slashIndex);
  const name = id.slice(slashIndex + 1);
  if (prefix !== TEMPLATE_PREFIX) {
    throw new DomainError(
      'validation',
      `Invalid template id: must start with 'template/' (got '${prefix}/')`,
      { invalid: ['id'] },
    );
  }
  if (name.length === 0) {
    throw new DomainError('validation', `Invalid template id: '${id}' (empty name)`, {
      invalid: ['id'],
    });
  }
  validateArtifactName(name);
  return { name };
}

export function formatTemplateId(name: string): string {
  return `${TEMPLATE_PREFIX}/${name}`;
}
