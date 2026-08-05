import { EventCategory, type IPublisher } from "@aos/event-bus";

import type { WorkflowDefinition } from "../schemas/workflow-definition.js";

import type { WorkflowDefinitionEventType } from "./workflow-definition-event-type.js";

/**
 * "EVENTS" (docs/PROMPT-005.6A-WORKFLOW-DEFINITION-LANGUAGE.md). Publishes onto the real
 * `@aos/event-bus` `IPublisher` — this package defines Workflows, it never executes
 * them, so every event carries definition metadata only (id/version/name/nodeCount), not
 * anything execution-related.
 */
export class WorkflowDefinitionEventPublisher {
  constructor(
    private readonly publisher: IPublisher,
    private readonly source: string = "workflow-definition",
  ) {}

  async publishDefinitionEvent(
    type: WorkflowDefinitionEventType,
    workflow: WorkflowDefinition,
    extra: Readonly<Record<string, unknown>> = {},
  ): Promise<void> {
    await this.publisher.publish({
      type,
      category: EventCategory.DOMAIN,
      payload: {
        workflowId: workflow.id,
        version: workflow.version,
        name: workflow.displayName ?? workflow.id,
        nodeCount: workflow.nodes.length,
        ...extra,
      },
      source: this.source,
      producer: "@aos/workflow-definition",
      tenantId: workflow.tenantId,
    });
  }
}
