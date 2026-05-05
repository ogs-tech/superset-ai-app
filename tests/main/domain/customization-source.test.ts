import { describe, it, expect } from 'vitest';
import {
  WORKSPACE_SOURCE,
  pluginSource,
  isPluginSource,
  isWorkspaceSource,
  type CustomizationSource,
} from '../../../src/main/domain/customization-source.js';
import { pluginId } from '../../../src/main/domain/plugin-id.js';

describe('CustomizationSource', () => {
  it('WORKSPACE_SOURCE has kind workspace', () => {
    expect(WORKSPACE_SOURCE.kind).toBe('workspace');
  });

  it('pluginSource() builds plugin variant', () => {
    const id = pluginId('superpowers');
    const src = pluginSource(id);
    expect(src.kind).toBe('plugin');
    if (src.kind === 'plugin') {
      expect(src.pluginId).toBe('superpowers');
    }
  });

  it('isPluginSource() narrows correctly', () => {
    const id = pluginId('foo');
    const src: CustomizationSource = pluginSource(id);
    expect(isPluginSource(src)).toBe(true);
    expect(isPluginSource(WORKSPACE_SOURCE)).toBe(false);
  });

  it('isWorkspaceSource() narrows correctly', () => {
    expect(isWorkspaceSource(WORKSPACE_SOURCE)).toBe(true);
    expect(isWorkspaceSource(pluginSource(pluginId('foo')))).toBe(false);
  });
});
