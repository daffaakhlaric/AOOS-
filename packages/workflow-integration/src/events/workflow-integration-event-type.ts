/** "EVENT INTEGRATION: Publish events using @aos/event-bus ... No runtime-specific events." (docs/PROMPT-005.6E-WORKFLOW-INTEGRATION.md). */
export enum WorkflowIntegrationEventType {
  STARTED = "workflow.integration.started",
  COMPLETED = "workflow.integration.completed",
  FAILED = "workflow.integration.failed",
  ADAPTER_RESOLVED = "workflow.integration.adapter.resolved",
  VALIDATION_FAILED = "workflow.integration.validation.failed",
  TIMEOUT = "workflow.integration.timeout",
  RETRY = "workflow.integration.retry",
  HEALTH_CHANGED = "workflow.integration.health.changed",
}
