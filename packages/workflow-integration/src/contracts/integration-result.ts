/** The generic result shape every future runtime contract in this package returns — see `integration-request.ts` for the matching rationale. */
export interface IntegrationResult {
  readonly success: boolean;
  readonly output?: Readonly<Record<string, unknown>>;
  readonly error?: string;
}
