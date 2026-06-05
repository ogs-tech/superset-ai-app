import type { CustomizationType } from '../../shared/customization.js';
import { DomainError } from './errors.js';
import { validateCustomizationName } from './customization-name.js';

const ARTIFACT_TYPES: readonly CustomizationType[] = [
  'skill',
  'agent',
  'global-instruction',
  'command',
];

export interface ParsedCustomizationId {
  type: CustomizationType;
  name: string;
}

export function parseCustomizationId(id: string): ParsedCustomizationId {
  const slashIndex = id.indexOf('/');
  if (slashIndex === -1) {
    throw new DomainError('validation', `Invalid customization id: '${id}' (missing '/')`, {
      invalid: ['id'],
    });
  }
  const typeCandidate = id.slice(0, slashIndex);
  const name = id.slice(slashIndex + 1);
  if (!isCustomizationType(typeCandidate)) {
    throw new DomainError(
      'validation',
      `Invalid customization id: unknown type '${typeCandidate}'`,
      { invalid: ['id'] },
    );
  }
  if (name.length === 0) {
    throw new DomainError('validation', `Invalid customization id: '${id}' (empty name)`, {
      invalid: ['id'],
    });
  }
  validateCustomizationName(name);
  return { type: typeCandidate, name };
}

export function formatCustomizationId(type: CustomizationType, name: string): string {
  return `${type}/${name}`;
}

function isCustomizationType(value: string): value is CustomizationType {
  return (ARTIFACT_TYPES as readonly string[]).includes(value);
}
