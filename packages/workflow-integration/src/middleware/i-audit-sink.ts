import type { IntegrationNamespace } from "../contracts/integration-namespace.js";

export interface AuditEntry {
  readonly workflowExecutionId: string;
  readonly namespace: IntegrationNamespace;
  readonly tenantId?: string;
  readonly userId?: string;
  readonly success?: boolean;
  readonly occurredAt: string;
}

/** The "Audit" middleware stage's extension point — a caller-supplied sink to persist `AuditEntry` records to, e.g. an append-only audit log store. No implementation ships in this package. */
export interface IAuditSink {
  record(entry: AuditEntry): void | Promise<void>;
}
