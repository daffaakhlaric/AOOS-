import { describe, expect, it } from "vitest";

import type { AgentContract, EventContract, ToolContract, WorkflowContract } from "../src/index.js";

/**
 * @aos/sdk is intentionally type-only (no runtime logic) — these tests exist to prove that a
 * conformant object literal type-checks against each Contract mirror and to give this package
 * genuine, if minimal, test coverage per the Foundation phase's testing requirement. The real
 * validation authority remains schemas/*.schema.json in the Contract Specification, not this SDK.
 */
describe("SDK contract type mirrors", () => {
  it("accepts a minimal conformant AgentContract object literal", () => {
    const agent: AgentContract = {
      id: "9c1f3e2a-2b1a-4e3a-8b0a-1a2b3c4d5e6f",
      code: "lead_scoring_agent",
      name: "LeadScoringAgent",
      display_name: "Lead Scoring Agent",
      version: "1.0.0",
      description: "Computes Lead Score from behavioral and profile signals.",
      category: "lead_intelligence",
      role: "Lead Qualifier",
      goal: "Score every Lead within SLA",
      objective: {
        metric: "time_to_hot_lead_p95_seconds",
        target_value: 60,
        deadline: "2026-12-31T00:00:00Z",
      },
      responsibilities: ["Compute Lead Score"],
      input_schema: "schemas/lead-scoring-input.schema.json",
      output_schema: "schemas/lead-scoring-output.schema.json",
      planner: "planner.lead_scoring.v1",
      reflection: "reflection.lead_scoring.v1",
      memory: "memory.lead_scoring.v1",
      toolset: ["tool.fetch_crm_lead"],
      permissions: "permission.lead_scoring_agent.v1",
      retry_policy: { max_attempts: 3, backoff_strategy: "exponential", backoff_base_ms: 500 },
      timeout: "PT30S",
      priority: 8,
      cost_limit: { amount: 0.05, currency: "USD", period: "per_invocation" },
      token_limit: { max_input_tokens: 4000, max_output_tokens: 500 },
      execution_mode: "event_driven",
      state: "draft",
      health: "health.lead_scoring_agent.v1",
      metrics: ["agent_success_rate"],
      logging: "logging.standard.v1",
      events: { publishes: ["lead.scored"], subscribes: ["lead.created"] },
      tenant_scope: "tenant_override_allowed",
      security_level: "standard",
      owner: "lead-intelligence-team",
    };

    expect(agent.code).toBe("lead_scoring_agent");
    expect(agent.state).toBe("draft");
  });

  it("accepts a minimal conformant ToolContract object literal", () => {
    const tool: ToolContract = {
      tool_id: "tool.fetch_crm_lead",
      provider: "internal",
      category: "crm",
      authentication: {},
      authorization: {},
      permission_scope: ["lead:read"],
      input_schema: "schemas/tool-input.schema.json",
      output_schema: "schemas/tool-output.schema.json",
      timeout: "PT10S",
      retry: { max_attempts: 3, backoff_strategy: "exponential", backoff_base_ms: 250 },
      circuit_breaker: { failure_threshold: 5, reset_timeout_ms: 30000 },
      rate_limit: { requests_per_second: 10, burst: 20 },
      health_check: "health.tool.fetch_crm_lead.v1",
      telemetry: ["tool_call_count"],
      metrics: ["tool_latency_ms"],
      cost: { amount: 0, currency: "USD", unit: "per_call" },
      version: "1.0.0",
      status: "draft",
    };

    expect(tool.status).toBe("draft");
  });

  it("accepts a minimal conformant WorkflowContract object literal", () => {
    const workflow: WorkflowContract = {
      workflow_id: "workflow.lead_qualification",
      version: "1.0.0",
      nodes: [{ id: "n1", type: "task", ref: "agent.lead_scoring_agent" }],
      edges: [],
      parallel_execution: false,
      retry_policy: { max_attempts: 1, backoff_strategy: "fixed", backoff_base_ms: 0 },
      timeout: "PT5M",
      priority: 5,
      events: { publishes: [], subscribes: ["lead.created"] },
      state_machine: {
        states: ["created", "running", "completed"],
        initial: "created",
        final: ["completed"],
      },
      metrics: [],
    };

    expect(workflow.nodes).toHaveLength(1);
  });

  it("accepts a minimal conformant EventContract object literal", () => {
    const event: EventContract<{ leadId: string; score: number }> = {
      event_id: "evt-1",
      event_name: "lead.scored",
      publisher: "agent.lead_scoring_agent",
      payload_schema: "schemas/lead-scored-payload.schema.json",
      payload: { leadId: "lead-1", score: 82 },
      priority: 5,
      retry: { max_attempts: 3, backoff_strategy: "exponential", backoff_base_ms: 500 },
      dead_letter: "dlq.lead.scored",
      trace_id: "trace-1",
      correlation_id: "corr-1",
      tenant_id: "tenant-1",
      timestamp: "2026-01-01T00:00:00Z",
    };

    expect(event.payload.score).toBe(82);
  });
});
