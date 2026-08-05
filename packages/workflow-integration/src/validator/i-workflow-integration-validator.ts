import type { IIntegrationAdapter } from "../adapter/i-integration-adapter.js";
import type { WorkflowIntegrationContext } from "../context/workflow-integration-context.js";
import type { WorkflowIntegrationRegistry } from "../registry/workflow-integration-registry.js";

export interface IntegrationValidationIssue {
  readonly path: string;
  readonly message: string;
}

export interface IntegrationValidationResult {
  readonly valid: boolean;
  readonly issues: readonly IntegrationValidationIssue[];
}

export interface IntegrationValidationInput {
  readonly registry: WorkflowIntegrationRegistry;
  readonly context?: WorkflowIntegrationContext;
  readonly adapter?: IIntegrationAdapter;
  readonly allowedTenantIds?: readonly string[];
  readonly allowedEnvironments?: readonly string[];
  /** Adapter name → the names of the other Adapters it depends on — used by the Circular/Dependency validators. */
  readonly dependencies?: Readonly<Record<string, readonly string[]>>;
}

/** One stage of `WorkflowIntegrationValidator` (Duplicate Adapter/Namespace/Version/Circular Integration/Missing Runtime/Tenant/Environment/Dependency — docs/PROMPT-005.6E-WORKFLOW-INTEGRATION.md — "INTEGRATION VALIDATOR"). */
export interface IIntegrationValidatorStage {
  readonly name: string;
  validate(input: IntegrationValidationInput): IntegrationValidationResult;
}
