import type { CustomizationRepository } from '../../application/ports/customization-repository.js';
import type { ReferenceRepository } from '../../application/ports/reference-repository.js';
import type { Reference, ReferenceFrontmatter } from '../../application/schemas/reference.js';
import { referenceId, type ReferenceId } from '../../domain/reference-id.js';
import { WORKSPACE_SOURCE } from '../../domain/customization-source.js';
import { formatCustomizationId } from '../../domain/customization-id.js';

function toReference(c: { id: string; frontmatter: unknown; body: string }): Reference {
  const fm = c.frontmatter as ReferenceFrontmatter;
  return {
    id: referenceId(fm.name),
    frontmatter: fm,
    source: WORKSPACE_SOURCE,
    body: c.body,
  };
}

export class FsReferenceRepository implements ReferenceRepository {
  constructor(private readonly base: CustomizationRepository) {}

  async list(): Promise<Reference[]> {
    const items = await this.base.list({ type: 'reference' });
    return items.map(toReference);
  }

  async get(query: { id: ReferenceId }): Promise<Reference> {
    const c = await this.base.get({ id: formatCustomizationId('reference', query.id) });
    return toReference(c);
  }

  async save(command: { reference: Reference }): Promise<Reference> {
    const saved = await this.base.save({
      customization: {
        id: formatCustomizationId('reference', command.reference.id),
        frontmatter: command.reference.frontmatter as never,
        body: command.reference.body,
      },
    });
    return toReference(saved);
  }

  async delete(command: { id: ReferenceId }): Promise<void> {
    await this.base.delete({ id: formatCustomizationId('reference', command.id) });
  }

  async exists(query: { id: ReferenceId }): Promise<boolean> {
    return this.base.exists({ id: formatCustomizationId('reference', query.id) });
  }
}
