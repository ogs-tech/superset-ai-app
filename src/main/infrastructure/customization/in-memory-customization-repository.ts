import type { Customization } from '../../../shared/customization.js';
import type {
  CustomizationDeleteCommand,
  CustomizationExistsQuery,
  CustomizationGetQuery,
  CustomizationListQuery,
  CustomizationRepository,
  CustomizationSaveCommand,
} from '../../application/ports/customization-repository.js';
import { DomainError } from '../../domain/errors.js';

export class InMemoryCustomizationRepository implements CustomizationRepository {
  private readonly store = new Map<string, Customization>();

  list(query?: CustomizationListQuery): Promise<Customization[]> {
    const all = Array.from(this.store.values()).map((a) => structuredClone(a));
    if (!query?.type) return Promise.resolve(all);
    return Promise.resolve(all.filter((a) => a.frontmatter.type === query.type));
  }

  get(query: CustomizationGetQuery): Promise<Customization> {
    const found = this.store.get(query.id);
    if (!found) {
      return Promise.reject(
        new DomainError('not_found', `Customization not found: ${query.id}`, { id: query.id }),
      );
    }
    return Promise.resolve(structuredClone(found));
  }

  save(command: CustomizationSaveCommand): Promise<Customization> {
    const cloned = structuredClone(command.customization);
    this.store.set(cloned.id, cloned);
    return Promise.resolve(structuredClone(cloned));
  }

  delete(command: CustomizationDeleteCommand): Promise<void> {
    if (!this.store.has(command.id)) {
      return Promise.reject(
        new DomainError('not_found', `Customization not found: ${command.id}`, {
          id: command.id,
        }),
      );
    }
    this.store.delete(command.id);
    return Promise.resolve();
  }

  exists(query: CustomizationExistsQuery): Promise<boolean> {
    return Promise.resolve(this.store.has(query.id));
  }
}
