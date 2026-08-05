/** Interface only — no implementation in this package. A future consumer schedules a deferred Runtime operation (e.g. auto-expire a Session) via `@aos/scheduler` behind this contract. */
export interface IKnowledgeRuntimeScheduler {
  scheduleAt(token: string, runAt: string, operation: string): Promise<string>;
  cancel(scheduleId: string): Promise<void>;
}
