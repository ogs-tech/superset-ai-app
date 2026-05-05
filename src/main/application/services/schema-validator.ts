import type { ZodIssue, ZodError } from 'zod';
import type { CustomizationFrontmatter } from '../../../shared/customization.js';
import type { TemplateFrontmatter } from '../../../shared/template.js';
import { skillSchema } from '../schemas/skill.js';
import { referenceSchema } from '../schemas/reference.js';
import { agentSchema } from '../schemas/agent.js';
import { globalInstructionSchema } from '../schemas/global-instruction.js';
import { commandSchema } from '../schemas/command.js';
import { templateSchema } from '../schemas/template.js';

export interface ValidationError {
  path: string;
  kind: string;
  message: string;
}

export type ValidationResult = { ok: true } | { ok: false; errors: ValidationError[] };

type ExtendedIssue = ZodIssue & { origin?: string; maximum?: number; minimum?: number };

const zodKindToValidationKind = (issue: ExtendedIssue): string => {
  const origin = issue.origin;
  switch (issue.code) {
    case 'invalid_type':
      if (issue.message.includes('undefined')) return 'required';
      return 'format';
    case 'too_small':
      if (origin === 'string') return 'min-length';
      return 'min-items';
    case 'too_big':
      if (origin === 'string') return 'max-length';
      if (origin === 'array' && issue.maximum === 1) return 'exact';
      return 'max-items';
    case 'invalid_value':
      return 'enum';
    case 'invalid_format':
      return 'format';
    case 'custom':
      if (issue.message?.includes('duplicate')) return 'unique';
      if (issue.message?.includes('exactly')) return 'exact';
      return 'format';
    default:
      return 'format';
  }
};

const pathToString = (path: ReadonlyArray<string | number>): string => {
  if (path.length === 0) return 'frontmatter';
  let result = 'frontmatter';
  for (const seg of path) {
    if (typeof seg === 'number') {
      result += `[${seg}]`;
    } else {
      result += `.${seg}`;
    }
  }
  return result;
};

const zodErrorToValidationErrors = (error: ZodError): ValidationError[] =>
  error.issues.map((issue) => ({
    path: pathToString(issue.path.filter((s): s is string | number => typeof s !== 'symbol')),
    kind: zodKindToValidationKind(issue as ExtendedIssue),
    message: issue.message,
  }));

export class SchemaValidator {
  validate(frontmatter: CustomizationFrontmatter): ValidationResult {
    const type = frontmatter.type;

    if (!type) {
      return {
        ok: false,
        errors: [{ path: 'frontmatter.type', kind: 'required', message: 'type is required' }],
      };
    }

    let result;
    switch (type) {
      case 'skill':
        result = skillSchema.safeParse(frontmatter);
        break;
      case 'reference':
        result = referenceSchema.safeParse(frontmatter);
        break;
      case 'agent':
        result = agentSchema.safeParse(frontmatter);
        break;
      case 'global-instruction':
        result = globalInstructionSchema.safeParse(frontmatter);
        break;
      case 'command':
        result = commandSchema.safeParse(frontmatter);
        break;
      default:
        return { ok: false, errors: [{ path: 'frontmatter.type', kind: 'enum', message: `Unknown type: ${String(type)}` }] };
    }

    if (!result.success) {
      return { ok: false, errors: zodErrorToValidationErrors(result.error) };
    }
    return { ok: true };
  }

  validateTemplate(frontmatter: TemplateFrontmatter): ValidationResult {
    const result = templateSchema.safeParse(frontmatter);
    if (!result.success) {
      return { ok: false, errors: zodErrorToValidationErrors(result.error) };
    }
    return { ok: true };
  }
}
