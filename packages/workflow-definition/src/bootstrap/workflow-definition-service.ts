import type { WorkflowDefinitionStatus } from "../contracts/workflow-definition-status.js";
import { RegistryException } from "../errors/registry-exception.js";
import type { WorkflowDefinitionEventPublisher } from "../events/workflow-definition-event-publisher.js";
import { WorkflowDefinitionEventType } from "../events/workflow-definition-event-type.js";
import type { IWorkflowDefinitionRegistry } from "../registry/i-workflow-definition-registry.js";
import type { WorkflowDefinitionEntry } from "../registry/workflow-definition-entry.js";
import { WorkflowDefinitionRegistry } from "../registry/workflow-definition-registry.js";
import type { WorkflowDefinition } from "../schemas/workflow-definition.js";
import type { ValidationResult } from "../validator/i-workflow-validator.js";
import { ValidationPipeline } from "../validator/validation-pipeline.js";

export interface WorkflowDefinitionServiceOptions {
  readonly eventPublisher: WorkflowDefinitionEventPublisher;
  readonly registry?: IWorkflowDefinitionRegistry;
}

/**
 * Ties the Workflow Definition Registry to Event Publishing — "Semua perubahan Job WAJIB
 * Publish Event" was 005.5's rule for Jobs; the equivalent rule here is every Registry
 * mutation and every explicit validation run publishes the matching
 * `workflow.definition.*` event. This is the composition root `bootstrap/
 * workflow-definition-system.ts` wraps as a Kernel Module.
 */
export class WorkflowDefinitionService {
  readonly registry: IWorkflowDefinitionRegistry;
  private readonly eventPublisher: WorkflowDefinitionEventPublisher;
  private readonly validationPipeline = new ValidationPipeline();

  constructor(options: WorkflowDefinitionServiceOptions) {
    this.registry = options.registry ?? new WorkflowDefinitionRegistry();
    this.eventPublisher = options.eventPublisher;
  }

  async createDefinition(
    workflow: WorkflowDefinition,
    status?: WorkflowDefinitionStatus,
  ): Promise<WorkflowDefinitionEntry> {
    const isFirstVersion = this.registry.versions(workflow.id).length === 0;
    const entry = this.registry.register(workflow, status);
    await this.eventPublisher.publishDefinitionEvent(WorkflowDefinitionEventType.CREATED, workflow);
    if (!isFirstVersion) {
      await this.eventPublisher.publishDefinitionEvent(
        WorkflowDefinitionEventType.VERSIONED,
        workflow,
      );
    }
    return entry;
  }

  async updateStatus(
    id: string,
    version: string,
    status: WorkflowDefinitionStatus,
  ): Promise<WorkflowDefinitionEntry> {
    const entry = this.registry.setStatus(id, version, status);
    await this.eventPublisher.publishDefinitionEvent(
      WorkflowDefinitionEventType.UPDATED,
      entry.workflow,
      {
        status,
      },
    );
    return entry;
  }

  async deleteDefinition(id: string, version: string): Promise<void> {
    const entry = this.registry.get(id, version);
    if (!entry) {
      throw new RegistryException(`Cannot delete "${id}@${version}": not registered`);
    }
    this.registry.remove(id, version);
    await this.eventPublisher.publishDefinitionEvent(
      WorkflowDefinitionEventType.DELETED,
      entry.workflow,
    );
  }

  async validateDefinition(workflow: WorkflowDefinition): Promise<ValidationResult> {
    const result = this.validationPipeline.run(workflow);
    await this.eventPublisher.publishDefinitionEvent(
      WorkflowDefinitionEventType.VALIDATED,
      workflow,
      {
        valid: result.valid,
        issueCount: result.issues.length,
      },
    );
    return result;
  }
}
