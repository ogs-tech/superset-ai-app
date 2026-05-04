import type { Template } from '../../../shared/template.js';
import type { ClockPort } from '../../application/ports/clock-port.js';
import type {
  TemplateDeleteCommand,
  TemplateGetQuery,
  TemplateListQuery,
  TemplateRepository,
} from '../../application/ports/template-repository.js';
import type { SchemaValidator } from './schema-validator.js';
import { isValidCustomizationName } from '../../domain/customization-name.js';
import { formatTemplateId } from '../../domain/template-id.js';
import { validationError } from '../../domain/errors.js';

export interface SaveTemplateCommand {
  template: Template;
  isCreate?: boolean;
}

export class TemplateService {
  constructor(
    private readonly repository: TemplateRepository,
    private readonly clock: ClockPort,
    private readonly schemaValidator?: SchemaValidator,
  ) {}

  list(query: TemplateListQuery = {}): Promise<Template[]> {
    return this.repository.list(query);
  }

  get(query: TemplateGetQuery): Promise<Template> {
    return this.repository.get(query);
  }

  async save(command: SaveTemplateCommand): Promise<Template> {
    const { template, isCreate = false } = command;
    this.validate(template);

    const id = formatTemplateId(template.frontmatter.name);
    const previousId = template.id;
    const isRename = !isCreate && previousId !== '' && previousId !== id;
    const exists = await this.repository.exists({ id });

    if (isCreate && exists) {
      throw validationError({
        message: `Template already exists: ${id}`,
        details: { conflict: id },
      });
    }
    if (isRename && exists) {
      throw validationError({
        message: `Template already exists: ${id}`,
        details: { conflict: id },
      });
    }

    const nowIso = this.clock.now().toISOString();
    let createdAt = nowIso;
    if (isRename) {
      const prev = await this.repository.get({ id: previousId });
      createdAt = prev.frontmatter.createdAt || nowIso;
    } else if (exists) {
      const prev = await this.repository.get({ id });
      createdAt = prev.frontmatter.createdAt || nowIso;
    }

    const persisted: Template = {
      id,
      frontmatter: {
        ...template.frontmatter,
        createdAt,
        updatedAt: nowIso,
      },
      body: template.body,
    };

    const saved = await this.repository.save({ template: persisted });
    if (isRename) {
      await this.repository.delete({ id: previousId });
    }
    return saved;
  }

  async delete(command: TemplateDeleteCommand): Promise<void> {
    await this.repository.delete(command);
  }

  private validate(template: Template): void {
    const fm = template.frontmatter;

    if (this.schemaValidator) {
      const placeholder = this.clock.now().toISOString();
      const fmForValidation = {
        ...fm,
        createdAt: fm.createdAt === '' ? placeholder : fm.createdAt,
        updatedAt: fm.updatedAt === '' ? placeholder : fm.updatedAt,
      };
      const result = this.schemaValidator.validateTemplate(fmForValidation);
      if (!result.ok) {
        throw validationError({
          message: `${result.errors.length} validation error(s)`,
          details: { errors: result.errors },
        });
      }
      return;
    }

    const missing: string[] = [];
    if (!fm.name) missing.push('name');
    if (!fm.targetType) missing.push('targetType');
    if (!fm.description) missing.push('description');
    if (!fm.version) missing.push('version');
    if (missing.length > 0) {
      throw validationError({
        message: `Missing required field(s): ${missing.join(', ')}`,
        details: { missing },
      });
    }
    const invalid: string[] = [];
    if (!isValidCustomizationName(fm.name)) invalid.push('name');
    if (!Array.isArray(fm.scopes) || fm.scopes.length === 0) invalid.push('scopes');
    if (invalid.length > 0) {
      throw validationError({
        message: `Invalid field(s): ${invalid.join(', ')}`,
        details: { invalid },
      });
    }
  }
}
