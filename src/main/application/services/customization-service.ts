import type {
  Customization,
  CustomizationFrontmatter,
  SyncResult,
} from '../../../shared/customization.js';
import type { ClockPort } from '../../application/ports/clock-port.js';
import type {
  CustomizationListQuery,
  CustomizationRepository,
} from '../../application/ports/customization-repository.js';
import type { AdapterManager } from './adapter-manager.js';
import type { SchemaValidator } from './schema-validator.js';
import { formatCustomizationId } from '../../domain/customization-id.js';
import { isValidCustomizationName } from '../../domain/customization-name.js';
import { DomainError, validationError } from '../../domain/errors.js';

const GLOBAL_INSTRUCTION_ALLOWED_SLUGS: ReadonlyArray<string> = ['default'];

export interface SaveCustomizationCommand {
  customization: Customization;
  isCreate?: boolean;
}

export interface SaveCustomizationResult {
  customization: Customization;
  syncReport: SyncResult[];
}

export interface DeleteCustomizationCommand {
  id: string;
  removeSymlinks: boolean;
}

export interface DeleteCustomizationResult {
  ok: true;
  syncReport?: SyncResult[];
}

/**
 * Shared engine for customization persistence: validation, ID formatting,
 * timestamp stamping, rename handling, and adapter sync. Backs the typed
 * facades (SkillService, AgentService, GlobalInstructionService).
 * Renderers go through the typed IPCs, never this service directly.
 */
export class CustomizationService {
  constructor(
    private readonly repository: CustomizationRepository,
    private readonly clock: ClockPort,
    private readonly adapterManager: AdapterManager,
    private readonly schemaValidator?: SchemaValidator,
  ) {}

  list(query: CustomizationListQuery = {}): Promise<Customization[]> {
    return this.repository.list(query);
  }

  get(query: { id: string }): Promise<Customization> {
    return this.repository.get(query);
  }

  async save(command: SaveCustomizationCommand): Promise<SaveCustomizationResult> {
    const { customization, isCreate = false } = command;
    this.validateCustomization(customization);

    const id = formatCustomizationId(
      customization.frontmatter.type,
      customization.frontmatter.name,
    );
    const previousId = customization.id;
    const isRename = !isCreate && previousId !== '' && previousId !== id;
    const exists = await this.repository.exists({ id });

    if (isCreate && exists) {
      throw validationError({
        message: `Customization already exists: ${id}`,
        details: { conflict: id },
      });
    }

    if (isRename && exists) {
      throw validationError({
        message: `Customization already exists: ${id}`,
        details: { conflict: id },
      });
    }

    const nowIso = this.clock.now().toISOString();
    let createdAt = nowIso;
    let previousCustomization: Customization | undefined;
    if (isRename) {
      previousCustomization = await this.repository.get({ id: previousId });
      createdAt = previousCustomization.frontmatter.createdAt || nowIso;
    } else if (exists) {
      const previous = await this.repository.get({ id });
      createdAt = previous.frontmatter.createdAt || nowIso;
    }

    const persisted: Customization = {
      id,
      frontmatter: {
        ...customization.frontmatter,
        createdAt,
        updatedAt: nowIso,
      },
      body: customization.body,
    };

    const saved = await this.repository.save({ customization: persisted });

    const removeReport: SyncResult[] = [];
    if (isRename && previousCustomization) {
      const removed = await this.adapterManager.removeOne({ customization: previousCustomization });
      removeReport.push(...removed);
      await this.repository.delete({ id: previousId });
    }

    const syncReport = await this.adapterManager.syncOne({ customization: saved });
    return { customization: saved, syncReport: [...removeReport, ...syncReport] };
  }

  async delete(command: DeleteCustomizationCommand): Promise<DeleteCustomizationResult> {
    let syncReport: SyncResult[] | undefined;
    if (command.removeSymlinks) {
      const customization = await this.repository.get({ id: command.id });
      syncReport = await this.adapterManager.removeOne({ customization });
    }
    await this.repository.delete({ id: command.id });
    return syncReport === undefined ? { ok: true } : { ok: true, syncReport };
  }

  private validateCustomization(customization: Customization): void {
    const fm = customization.frontmatter;

    if (this.schemaValidator) {
      // Empty timestamps signal "not yet stamped" — the service will fill them in
      // before persisting. Substitute the current clock so the schema sees a valid
      // ISO datetime and validates the rest of the frontmatter.
      const placeholder = this.clock.now().toISOString();
      const fmForValidation = {
        ...fm,
        createdAt: fm.createdAt === '' ? placeholder : fm.createdAt,
        updatedAt: fm.updatedAt === '' ? placeholder : fm.updatedAt,
      };
      const result = this.schemaValidator.validate(fmForValidation);
      if (!result.ok) {
        throw validationError({
          message: `${result.errors.length} validation error(s)`,
          details: { errors: result.errors },
        });
      }
      return;
    }

    if (fm.type === 'global-instruction') {
      this.validateGlobalInstruction(fm);
    }

    const missing: string[] = [];
    const REQUIRED_FIELDS: Array<keyof CustomizationFrontmatter> = [
      'name',
      'type',
      'description',
      'version',
    ];
    for (const field of REQUIRED_FIELDS) {
      const value = fm[field];
      if (value === undefined || value === null || value === '') {
        missing.push(field);
      }
    }
    if (missing.length > 0) {
      throw validationError({
        message: `Missing required field(s): ${missing.join(', ')}`,
        details: { missing },
      });
    }

    const invalid: string[] = [];
    if (!isValidCustomizationName(fm.name)) invalid.push('name');
    if (!Array.isArray(fm.scopes) || fm.scopes.length === 0) invalid.push('scopes');
    if (fm.description && fm.description.length > 200) invalid.push('description');
    if (invalid.length > 0) {
      throw validationError({
        message: `Invalid field(s): ${invalid.join(', ')}`,
        details: { invalid },
      });
    }
  }

  private validateGlobalInstruction(fm: CustomizationFrontmatter): void {
    if (!GLOBAL_INSTRUCTION_ALLOWED_SLUGS.includes(fm.name)) {
      throw validationError({
        message: `Invalid slug for global-instruction: '${fm.name}' (must be 'default')`,
        details: { reason: 'global-instruction-slug-not-allowed' },
      });
    }
    const scopes = Array.isArray(fm.scopes) ? fm.scopes : [];
    if (scopes.length !== 1 || scopes[0] !== 'personal') {
      throw validationError({
        message: `Invalid scopes for global-instruction: must be exactly ['personal']`,
        details: { reason: 'global-instruction-scope-must-be-personal' },
      });
    }
  }
}

export { DomainError };
