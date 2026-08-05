/** "Compensation Provider — No implementation." (docs/PROMPT-005.6E-WORKFLOW-INTEGRATION.md — "FUTURE READY"). */
export interface CompensationAction {
  readonly adapterName: string;
  readonly reason: string;
}

export interface ICompensationProvider {
  compensate(action: CompensationAction): Promise<void>;
}
