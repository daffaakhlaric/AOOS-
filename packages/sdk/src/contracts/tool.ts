import type { JsonObject } from "@aos/types";

/**
 * Type-only mirror of the Tool Contract (contracts/tool.contract.md,
 * schemas/tool.schema.json, docs/003.5-CONTRACT-FIRST-DESIGN.md §3).
 * No Tool Manager implementation exists yet — see agent.ts's file-level note, which applies equally here.
 */
export interface ToolContract {
  readonly tool_id: string;
  readonly provider: string;
  readonly category: string;
  readonly authentication: JsonObject;
  readonly authorization: JsonObject;
  readonly permission_scope: readonly string[];
  readonly input_schema: string;
  readonly output_schema: string;
  readonly timeout: string;
  readonly retry: {
    readonly max_attempts: number;
    readonly backoff_strategy: "fixed" | "linear" | "exponential";
    readonly backoff_base_ms: number;
  };
  readonly rollback?: JsonObject;
  readonly compensation?: JsonObject;
  readonly circuit_breaker: {
    readonly failure_threshold: number;
    readonly reset_timeout_ms: number;
  };
  readonly rate_limit: {
    readonly requests_per_second: number;
    readonly burst: number;
  };
  readonly quota?: {
    readonly max_calls: number;
    readonly period: "hourly" | "daily" | "monthly";
  };
  readonly health_check: string;
  readonly telemetry: readonly string[];
  readonly metrics: readonly string[];
  readonly cost: {
    readonly amount: number;
    readonly currency: string;
    readonly unit: string;
  };
  readonly version: string;
  readonly status: "draft" | "active" | "deprecated" | "retired";
}

/** The side-effect classification every Tool must declare (Constitution RULE-007). */
export type ToolSideEffectClass = "read_only" | "reversible_write" | "irreversible_write";
