export interface DispatchDecision {
  readonly jobId: string;
  readonly dispatched: boolean;
  readonly reason?: string;
}

export interface IDispatcher {
  dispatch(jobId: string): Promise<DispatchDecision>;
}
