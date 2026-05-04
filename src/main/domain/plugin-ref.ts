export type PluginRef =
  | { kind: 'branch'; value: string }
  | { kind: 'tag'; value: string }
  | { kind: 'sha'; value: string };

export class PluginRefInvalidError extends Error {
  override readonly name = 'PluginRefInvalidError';
  readonly details?: { raw: unknown } | undefined;

  constructor(message: string, details?: { raw: unknown }) {
    super(message);
    this.details = details;
  }
}

export function pluginRefBranch(value: string): PluginRef {
  if (value.length === 0) {
    throw new PluginRefInvalidError('Branch value cannot be empty');
  }
  return { kind: 'branch', value };
}

export function pluginRefTag(value: string): PluginRef {
  if (value.length === 0) {
    throw new PluginRefInvalidError('Tag value cannot be empty');
  }
  return { kind: 'tag', value };
}

export function pluginRefSha(value: string): PluginRef {
  if (value.length === 0) {
    throw new PluginRefInvalidError('SHA value cannot be empty');
  }
  if (!/^[a-fA-F0-9]+$/.test(value)) {
    throw new PluginRefInvalidError('SHA value must be hexadecimal');
  }
  return { kind: 'sha', value };
}

export function isPluginRef(value: unknown): value is PluginRef {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const obj = value as Record<string, unknown>;

  if (!('kind' in obj) || !('value' in obj)) {
    return false;
  }

  const kind = obj.kind;
  const refValue = obj.value;

  if (typeof refValue !== 'string') {
    return false;
  }

  return kind === 'branch' || kind === 'tag' || kind === 'sha';
}

export function parsePluginRef(raw: unknown): PluginRef {
  if (!isPluginRef(raw)) {
    throw new PluginRefInvalidError('Invalid PluginRef format', { raw });
  }

  const { kind, value } = raw;

  if (kind === 'branch') {
    return pluginRefBranch(value);
  } else if (kind === 'tag') {
    return pluginRefTag(value);
  } else if (kind === 'sha') {
    return pluginRefSha(value);
  } else {
    throw new PluginRefInvalidError('Unknown PluginRef kind', { raw });
  }
}
