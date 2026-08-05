import type { CompensationConfig } from "../contracts/compensation-config.js";
import type { RetryConfig } from "../contracts/retry-config.js";
import type { TenantScope } from "../contracts/tenant-scope.js";
import type { TimeoutConfig } from "../contracts/timeout-config.js";
import { BuilderException } from "../errors/builder-exception.js";
import type { Labels, Tags, WorkflowMetadata } from "../metadata/workflow-metadata.js";
import type { Node } from "../nodes/node.js";
import type { ErrorHandling } from "../schemas/error-handling.js";
import {
  workflowDefinitionSchema,
  type WorkflowDefinition,
} from "../schemas/workflow-definition.js";
import type { Transition } from "../transitions/transition.js";
import type { VariableDeclaration } from "../variables/variable-declaration.js";

/** WorkflowBuilder — fluent construction of a `WorkflowDefinition`. `.build()` validates the assembled shape against `workflowDefinitionSchema`; run `validator/validation-pipeline.ts` separately for the deeper structural rules (Cycle/Duplicate/Variable/... Detection). */
export class WorkflowBuilder {
  private fields: Record<string, unknown>;
  private nodeList: Node[] = [];
  private transitionList: Transition[] = [];
  private variableList: VariableDeclaration[] = [];

  private constructor(id: string, version: string) {
    this.fields = { id, version };
  }

  static create(id: string, version: string): WorkflowBuilder {
    return new WorkflowBuilder(id, version);
  }

  withNamespace(namespace: string): this {
    this.fields = { ...this.fields, namespace };
    return this;
  }

  withDisplayName(displayName: string): this {
    this.fields = { ...this.fields, displayName };
    return this;
  }

  withDescription(description: string): this {
    this.fields = { ...this.fields, description };
    return this;
  }

  withLabels(labels: Labels): this {
    this.fields = { ...this.fields, labels };
    return this;
  }

  withTags(tags: Tags): this {
    this.fields = { ...this.fields, tags };
    return this;
  }

  withTenantScope(tenantScope: TenantScope, tenantId?: string): this {
    this.fields = { ...this.fields, tenantScope, tenantId };
    return this;
  }

  withMetadata(metadata: WorkflowMetadata): this {
    this.fields = { ...this.fields, metadata };
    return this;
  }

  withInput(input: Readonly<Record<string, string>>): this {
    this.fields = { ...this.fields, input };
    return this;
  }

  withOutput(output: Readonly<Record<string, string>>): this {
    this.fields = { ...this.fields, output };
    return this;
  }

  addVariable(variable: VariableDeclaration): this {
    this.variableList = [...this.variableList, variable];
    return this;
  }

  addNode(node: Node): this {
    this.nodeList = [...this.nodeList, node];
    return this;
  }

  addTransition(transition: Transition): this {
    this.transitionList = [...this.transitionList, transition];
    return this;
  }

  withErrorHandling(errorHandling: ErrorHandling): this {
    this.fields = { ...this.fields, errorHandling };
    return this;
  }

  withCompensation(compensation: CompensationConfig): this {
    this.fields = { ...this.fields, compensation };
    return this;
  }

  withRetry(retry: RetryConfig): this {
    this.fields = { ...this.fields, retry };
    return this;
  }

  withTimeout(timeout: TimeoutConfig): this {
    this.fields = { ...this.fields, timeout };
    return this;
  }

  withEvents(events: readonly string[]): this {
    this.fields = { ...this.fields, events };
    return this;
  }

  withPermissions(permissions: readonly string[]): this {
    this.fields = { ...this.fields, permissions };
    return this;
  }

  build(): WorkflowDefinition {
    const candidate = {
      ...this.fields,
      nodes: this.nodeList,
      transitions: this.transitionList,
      variables: this.variableList,
    };
    const result = workflowDefinitionSchema.safeParse(candidate);
    if (!result.success) {
      throw new BuilderException(
        `Failed to build WorkflowDefinition "${String(this.fields["id"])}": ${result.error.issues
          .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
          .join("; ")}`,
      );
    }
    return result.data;
  }
}
