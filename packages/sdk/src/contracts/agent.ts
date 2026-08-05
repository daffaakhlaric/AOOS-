import type { JsonObject } from "@aos/types";

/**
 * Type-only mirror of the Agent Contract (contracts/agent.contract.md,
 * schemas/agent.schema.json, docs/003.5-CONTRACT-FIRST-DESIGN.md §2).
 *
 * This is a STRUCTURAL TYPE ONLY — no Agent Runtime, Planner, Reasoner, or Reflection
 * implementation exists yet (explicitly forbidden at the Foundation phase per
 * docs/PROMPT-005.1-CORE-RUNTIME-FOUNDATION.md). Field names intentionally match the
 * Contract's JSON Schema exactly (snake_case) so this type can later validate/be validated
 * against schemas/agent.schema.json without a translation layer.
 */
export interface AgentContract {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly display_name: string;
  readonly version: string;
  readonly description: string;
  readonly category:
    | "lead_intelligence"
    | "nurturing"
    | "campaign_ops"
    | "content"
    | "conversation"
    | "analytics"
    | "strategic";
  readonly role: string;
  readonly goal: string;
  readonly objective: {
    readonly metric: string;
    readonly target_value: number;
    readonly deadline: string;
  };
  readonly responsibilities: readonly string[];
  readonly input_schema: string;
  readonly output_schema: string;
  readonly planner: string;
  readonly reasoner?: string;
  readonly reflection: string;
  readonly memory: string;
  readonly knowledge?: readonly string[];
  readonly workflow?: readonly string[];
  readonly toolset: readonly string[];
  readonly permissions: string;
  readonly scheduler?: string;
  readonly retry_policy: {
    readonly max_attempts: number;
    readonly backoff_strategy: "fixed" | "linear" | "exponential";
    readonly backoff_base_ms: number;
  };
  readonly timeout: string;
  readonly priority: number;
  readonly cost_limit: {
    readonly amount: number;
    readonly currency: string;
    readonly period: "per_invocation" | "hourly" | "daily" | "monthly";
  };
  readonly token_limit: {
    readonly max_input_tokens: number;
    readonly max_output_tokens: number;
  };
  readonly execution_mode: "sync" | "async" | "scheduled" | "event_driven";
  readonly state: "draft" | "active" | "deprecated" | "retired" | "quarantined";
  readonly health: string;
  readonly metrics: readonly string[];
  readonly logging: string;
  readonly events: {
    readonly publishes: readonly string[];
    readonly subscribes: readonly string[];
  };
  readonly dependencies?: readonly string[];
  readonly configuration?: JsonObject;
  readonly tenant_scope: "global" | "tenant_override_allowed" | "tenant_only";
  readonly security_level: "standard" | "elevated" | "restricted";
  readonly owner: string;
  readonly tags?: readonly string[];
  readonly metadata?: JsonObject;
}
