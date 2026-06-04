import type { Customization, CustomizationType } from '../../shared/customization.js';

/**
 * Build an empty Customization pre-filled with sensible defaults for a "New"
 * create flow. `global-instruction` is special-cased: the schema requires
 * name === 'default' and scopes === ['personal'].
 */
export function blankCustomization(type: CustomizationType): Customization {
  return {
    id: '',
    frontmatter: {
      name: type === 'global-instruction' ? 'default' : '',
      type,
      description: '',
      scopes: ['personal'],
      version: '0.1.0',
      createdAt: '',
      updatedAt: '',
    },
    body: '',
  };
}
