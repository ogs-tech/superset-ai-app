import type { CustomizationService } from './customization-service.js';
import type { Reference, ReferenceFrontmatter } from '../schemas/reference.js';
import type { ReferenceId } from '../../domain/reference-id.js';
import type { SyncResult } from '../../../shared/customization.js';
import { referenceId } from '../../domain/reference-id.js';
import { WORKSPACE_SOURCE } from '../../domain/customization-source.js';
import { formatCustomizationId } from '../../domain/customization-id.js';

export interface SaveReferenceResult {
  reference: Reference;
  syncReport: SyncResult[];
}

function toReference(c: { id: string; frontmatter: unknown; body: string }): Reference {
  const fm = c.frontmatter as ReferenceFrontmatter;
  return {
    id: referenceId(fm.name),
    frontmatter: fm,
    source: WORKSPACE_SOURCE,
    body: c.body,
  };
}

export class ReferenceService {
  constructor(private readonly base: CustomizationService) {}

  async list(): Promise<Reference[]> {
    const items = await this.base.list({ type: 'reference' });
    return items.map(toReference);
  }

  async get(id: ReferenceId): Promise<Reference> {
    const c = await this.base.get({ id: formatCustomizationId('reference', id) });
    return toReference(c);
  }

  async save(input: {
    reference: Reference;
    isCreate?: boolean;
  }): Promise<SaveReferenceResult> {
    const result = await this.base.save({
      customization: {
        id: formatCustomizationId('reference', input.reference.id),
        frontmatter: input.reference.frontmatter as never,
        body: input.reference.body,
      },
      ...(input.isCreate !== undefined ? { isCreate: input.isCreate } : {}),
    });
    return {
      reference: toReference(result.customization),
      syncReport: result.syncReport,
    };
  }

  async delete(input: { id: ReferenceId; removeSymlinks: boolean }): Promise<{
    ok: true;
    syncReport?: SyncResult[];
  }> {
    return this.base.delete({
      id: formatCustomizationId('reference', input.id),
      removeSymlinks: input.removeSymlinks,
    });
  }
}
