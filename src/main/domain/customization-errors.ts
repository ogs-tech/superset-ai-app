export class SkillIdInvalidError extends Error {
  override readonly name = 'SkillIdInvalidError';
  readonly details: { raw?: string } | undefined;
  constructor(message: string, details?: { raw?: string }) {
    super(message);
    this.details = details;
  }
}

export class AgentIdInvalidError extends Error {
  override readonly name = 'AgentIdInvalidError';
  readonly details: { raw?: string } | undefined;
  constructor(message: string, details?: { raw?: string }) {
    super(message);
    this.details = details;
  }
}

export class ReferenceIdInvalidError extends Error {
  override readonly name = 'ReferenceIdInvalidError';
  readonly details: { raw?: string } | undefined;
  constructor(message: string, details?: { raw?: string }) {
    super(message);
    this.details = details;
  }
}

export class GlobalInstructionIdInvalidError extends Error {
  override readonly name = 'GlobalInstructionIdInvalidError';
  readonly details: { raw?: string } | undefined;
  constructor(message: string, details?: { raw?: string }) {
    super(message);
    this.details = details;
  }
}

export class MarketplaceIdInvalidError extends Error {
  override readonly name = 'MarketplaceIdInvalidError';
  readonly details: { raw?: string } | undefined;
  constructor(message: string, details?: { raw?: string }) {
    super(message);
    this.details = details;
  }
}
