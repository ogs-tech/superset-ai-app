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

describe('pluginSource provenance', () => {
  it('defaults provenance to workspace-managed', () => {
    const src = pluginSource(pluginId('superpowers'));
    expect(src).toEqual({
      kind: 'plugin',
      pluginId: 'superpowers',
      provenance: 'workspace-managed',
    });
  });

  it('carries an explicit claude-code provenance', () => {
    const src = pluginSource(pluginId('feature-dev'), 'claude-code');
    expect(src).toEqual({
      kind: 'plugin',
      pluginId: 'feature-dev',
      provenance: 'claude-code',
    });
  });
});
