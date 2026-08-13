/** Payload for `aaos.capi-connector.batch.completed`, published once per `EventBatcherService.flush()` call, success or failure. */
export interface BatchCompleted {
  readonly batchSize: number;
  readonly successCount: number;
  readonly failureCount: number;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
