/** "Saga Provider — No implementation." (docs/PROMPT-005.6E-WORKFLOW-INTEGRATION.md — "FUTURE READY"). */
export interface SagaStep {
  readonly adapterName: string;
  readonly forwardOperation: string;
  readonly compensatingOperation?: string;
}

export interface ISagaProvider {
  begin(steps: readonly SagaStep[]): Promise<string>;
  complete(sagaId: string): Promise<void>;
  abort(sagaId: string, reason: string): Promise<void>;
}
