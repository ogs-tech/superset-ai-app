export interface GenerateResult {
  path: string;
  refsIncluded: number;
}

export interface CopilotInstructionsGenPort {
  generate(): Promise<GenerateResult>;
}
