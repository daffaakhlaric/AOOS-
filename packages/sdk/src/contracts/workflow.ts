import type { JsonObject } from "@aos/types";

/**
 * Type-only mirror of the Workflow Contract (contracts/workflow.contract.md,
 * schemas/workflow.schema.json, docs/003.5-CONTRACT-FIRST-DESIGN.md §4).
 * No Workflow Runtime implementation exists yet — see agent.ts's file-level note, which applies equally here.
 */
export interface WorkflowNode {
  readonly id: string;
  readonly type: "task" | "decision" | "parallel" | "compensation";
  readonly ref: string;
}

export interface WorkflowEdge {
  readonly from: string;
  readonly to: string;
  readonly condition?: string;
}

export interface WorkflowContract {
  readonly workflow_id: string;
  readonly version: string;
  readonly nodes: readonly WorkflowNode[];
  readonly edges: readonly WorkflowEdge[];
  readonly conditions?: JsonObject;
  readonly parallel_execution: boolean;
  readonly retry_policy: {
    readonly max_attempts: number;
    readonly backoff_strategy: "fixed" | "linear" | "exponential";
    readonly backoff_base_ms: number;
  };
  readonly rollback?: JsonObject;
  readonly compensation?: JsonObject;
  readonly timeout: string;
  readonly priority: number;
  readonly events: {
    readonly publishes: readonly string[];
    readonly subscribes: readonly string[];
  };
  readonly dependencies?: readonly string[];
  readonly state_machine: {
    readonly states: readonly string[];
    readonly initial: string;
    readonly final: readonly string[];
  };
  readonly metrics: readonly string[];
}
