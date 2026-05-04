import type { Customization, CustomizationType } from '../../../shared/customization.js';

export interface CustomizationListQuery {
  type?: CustomizationType;
}

export interface CustomizationGetQuery {
  id: string;
}

export interface CustomizationSaveCommand {
  customization: Customization;
}

export interface CustomizationDeleteCommand {
  id: string;
}

export interface CustomizationExistsQuery {
  id: string;
}

export interface CustomizationRepository {
  list(query?: CustomizationListQuery): Promise<Customization[]>;
  get(query: CustomizationGetQuery): Promise<Customization>;
  save(command: CustomizationSaveCommand): Promise<Customization>;
  delete(command: CustomizationDeleteCommand): Promise<void>;
  exists(query: CustomizationExistsQuery): Promise<boolean>;
}
